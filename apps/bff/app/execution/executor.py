"""Executor: APPROVED -> submit the bound Argo workflow (E06 Task 2).

Exactly-once, two layers of defense:
  1. The DB `workflow_ref` short-circuits a re-run once the submit is committed.
  2. Submit uses a deterministic Argo workflow name (`req-<id>`). If a crash
     lands between submit and the DB commit, the retry re-submits the SAME name;
     Argo rejects the duplicate with AlreadyExists (409), which we treat as
     "already submitted" instead of creating a second workflow. THIS is the
     idempotency key — the `request-id` label is metadata only.
"""

from __future__ import annotations

from typing import Protocol

from app.argo.models import WorkflowAlreadyExists, WorkflowRef
from app.config import settings
from app.execution.binding import Binding, map_params, resolve_binding
from app.models.request import Request
from app.requests.state import transition
from app.services import definition as service_def


class _Argo(Protocol):
    async def submit(
        self, template: str, parameters: dict, labels: dict, name: str
    ) -> WorkflowRef: ...


async def on_approved(req: Request, argo: _Argo, session) -> Request:
    """Submit the workflow bound to this request's type/action, then move
    APPROVED -> EXECUTING. Idempotent: the committed workflow_ref short-circuits,
    and a retry racing the commit window hits Argo's AlreadyExists."""
    if req.workflow_ref is not None:
        return req  # already submitted + committed — fast path

    # Binding from the resource type's ServiceDefinition (E08); fall back to the
    # static default when the type has no onboarded definition yet.
    bound = await service_def.effective_binding(session, req.resource_type, req.action)
    binding = (
        Binding(template_ref=bound["template_ref"], param_map=bound.get("param_map", {}))
        if bound and bound.get("template_ref")
        else resolve_binding(req.resource_type, req.action)
    )
    source = {
        "action": req.action,
        "resource_type": req.resource_type,
        "resource_id": req.resource_id,
        "payload": req.payload,
    }
    params = map_params(source, binding.param_map)
    # Deterministic name: same request -> same workflow, so a retry can't double-submit.
    name = f"req-{req.id}"
    try:
        ref = await argo.submit(
            binding.template_ref, params, {"request-id": str(req.id)}, name=name
        )
    except WorkflowAlreadyExists:
        # A prior submit already created this workflow (its commit was lost to a
        # crash). Resolve the deterministic ref and proceed — do NOT re-submit.
        ref = WorkflowRef(namespace=settings.argo_namespace, name=name)

    req.workflow_ref = f"{ref.namespace}/{ref.name}"
    transition(req, "execute", actor="system", note="workflow submitted")
    await session.commit()
    return req
