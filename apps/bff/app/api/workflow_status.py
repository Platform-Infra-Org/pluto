"""GET /api/requests/{id}/status — live workflow node tree for the SPA (E06 Task 5).

The browser never holds the Argo token: the BFF fetches status server-side and
returns a normalized node tree + current phase + the failed step. Visibility is
scoped exactly like the request read endpoint (requester / owner-team / admin /
auditor; else 404). Live push lands in E07 — for now the SPA polls this.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.requests import _can_see, _load
from app.argo.client import ArgoClient
from app.argo.models import WorkflowRef
from app.argo.status import find_failed_step
from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.db import get_session

router = APIRouter(prefix="/api/requests")


async def get_argo_client() -> AsyncIterator[ArgoClient]:
    """Injectable ArgoClient (overridden in tests). One per request; closed after."""
    client = ArgoClient()
    try:
        yield client
    finally:
        await client.aclose()


def _node_dict(node, failed_id: str | None) -> dict:
    return {
        "id": node.id,
        "name": node.name,
        "display_name": node.display_name,
        "type": node.type,
        "phase": node.phase,
        "message": node.message,
        "children": node.children,
        "failed": node.id == failed_id,
    }


@router.get("/{request_id}/status")
async def request_status(
    request_id: int,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
    argo: ArgoClient = Depends(get_argo_client),
) -> dict:
    req = await _load(session, request_id)
    # 404 (not 403) for requests the caller may not see — don't reveal existence.
    if not _can_see(principal, req):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "request not found")

    # Not submitted yet (or terminal already recorded): serve persisted truth.
    if not req.workflow_ref:
        return {"phase": req.state, "nodes": [], "failed_step": req.failure}

    namespace, _, name = req.workflow_ref.partition("/")
    ws = await argo.get(WorkflowRef(namespace=namespace, name=name))
    failed = find_failed_step(ws)
    failed_id = failed.id if failed else None
    nodes = [_node_dict(n, failed_id) for n in sorted(ws.nodes.values(), key=lambda n: n.id)]
    return {
        "phase": ws.phase,
        "nodes": nodes,
        "failed_step": (
            {"node": failed.display_name or failed.name, "message": failed.message, "phase": ws.phase}
            if failed
            else req.failure
        ),
    }
