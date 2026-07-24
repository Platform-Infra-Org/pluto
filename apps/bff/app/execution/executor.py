"""Executor: APPROVED -> submit the bound Argo workflow (E06 Task 2).

Idempotent two ways: the DB `workflow_ref` short-circuits a re-run in this BFF,
and the `request-id` workflow label is Argo's own idempotency key so even a
racing/restarted submit doesn't double-execute. The request id is an int, so the
label value never contains a comma (Argo's label string is comma-joined).
"""

from __future__ import annotations

from typing import Protocol

from app.argo.models import WorkflowRef
from app.execution.binding import map_params, resolve_binding
from app.models.request import Request
from app.requests.state import transition


class _Argo(Protocol):
    async def submit(self, template: str, parameters: dict, labels: dict) -> WorkflowRef: ...


async def on_approved(req: Request, argo: _Argo, session) -> Request:
    """Submit the workflow bound to this request's type/action, then move
    APPROVED -> EXECUTING. No-op if already submitted (idempotent retry)."""
    if req.workflow_ref is not None:
        return req  # already submitted — retry must not double-execute

    binding = resolve_binding(req.resource_type, req.action)
    source = {
        "action": req.action,
        "resource_type": req.resource_type,
        "resource_id": req.resource_id,
        "payload": req.payload,
    }
    params = map_params(source, binding.param_map)
    ref = await argo.submit(binding.template_ref, params, {"request-id": str(req.id)})

    req.workflow_ref = f"{ref.namespace}/{ref.name}"
    transition(req, "execute", actor="system", note="workflow submitted")
    await session.commit()
    return req
