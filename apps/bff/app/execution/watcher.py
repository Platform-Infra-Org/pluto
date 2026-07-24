"""Watcher: stream Argo status -> terminal request state (E06 Tasks 3 & 4).

Consumes `ArgoClient.watch`, maps the final phase to SUCCEEDED / FAILED, and on
failure persists the accurate failed leaf step (`find_failed_step`). Resilience:
if the stream yields nothing terminal (dropped connection / BFF restart), it
reconciles once via `get` — Git + status.nodes are the durable truth. On success
it re-indexes the catalog (the workflow, not the BFF, wrote to Git).
"""

from __future__ import annotations

from typing import Awaitable, Callable, Protocol

from app.argo.models import WorkflowRef, WorkflowStatus
from app.argo.status import find_failed_step
from app.catalog.git_sync import sync_repo
from app.models.request import Request
from app.notifications import events
from app.requests.state import transition

_TERMINAL = {"Succeeded", "Failed", "Error"}


class _Argo(Protocol):
    def watch(self, ref: WorkflowRef): ...
    async def get(self, ref: WorkflowRef) -> WorkflowStatus: ...


def _parse_ref(workflow_ref: str) -> WorkflowRef:
    namespace, _, name = workflow_ref.partition("/")
    return WorkflowRef(namespace=namespace, name=name)


async def watch_request(
    req: Request,
    argo: _Argo,
    session,
    reindex: Callable[[], Awaitable] = sync_repo,
) -> Request:
    """Watch `req`'s workflow to a terminal phase and record the outcome."""
    if req.workflow_ref is None:
        raise ValueError("request has no workflow_ref to watch")
    ref = _parse_ref(req.workflow_ref)

    ws: WorkflowStatus | None = None
    async for ws in argo.watch(ref):  # noqa: B007 — last value is what we want
        pass  # E07 will push each event over SSE; here we only need the terminal.

    if ws is None or ws.phase not in _TERMINAL:
        ws = await argo.get(ref)  # reconcile after a drop / restart

    await _apply_terminal(req, ws, session, reindex)
    return req


async def _apply_terminal(req, ws, session, reindex) -> None:
    if ws.phase == "Succeeded":
        transition(req, "succeed", actor="system", note="workflow succeeded")
        await session.commit()
        await events.notify_safe(events.workflow_succeeded, session, req)
        await reindex()  # workflow committed to Git -> refresh the catalog index
    elif ws.phase in ("Failed", "Error"):
        step = find_failed_step(ws)
        req.failure = (
            {
                "node": step.display_name or step.name,
                "message": step.message,
                "phase": ws.phase,
            }
            if step is not None
            else {"node": None, "message": ws.phase, "phase": ws.phase}
        )
        transition(req, "fail", actor="system", note="workflow failed")
        await session.commit()
        await events.notify_safe(events.workflow_failed, session, req)
    # Non-terminal ws here would mean the workflow is still running with no
    # terminal truth yet; leave the request EXECUTING for the next reconcile.
