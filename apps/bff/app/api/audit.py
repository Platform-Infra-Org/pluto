"""Auditor read views (E09 Task 1).

The `auditor` role is read-only across **every** team: it can review all requests,
approvals and `admin_bypass` events but change nothing (writes are refused by
`writer_principal` / per-endpoint authz). `platform-admin` may read these too.
The trail itself is immutable — these endpoints only ever SELECT.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import require_any
from app.db import get_session
from app.models.request import Request, RequestEvent

router = APIRouter(prefix="/api/audit")

# Both roles read the audit trail; only auditor is write-restricted elsewhere.
_read_audit = require_any("auditor", "platform-admin")


def _dump(req: Request) -> dict:
    return {
        "id": req.id,
        "kind": req.kind,
        "action": req.action,
        "resource_type": req.resource_type,
        "owner_team": req.owner_team,
        "requester": req.requester,
        "state": req.state,
        "approvals": req.approvals,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }


@router.get("/requests")
async def audit_requests(
    state: str | None = None,
    team: str | None = None,
    kind: str | None = None,
    _=Depends(_read_audit),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Every request across every team (optional state/team/kind filters)."""
    stmt = select(Request).order_by(Request.id.desc())
    if state:
        stmt = stmt.where(Request.state == state)
    if team:
        stmt = stmt.where(Request.owner_team == team)
    if kind:
        stmt = stmt.where(Request.kind == kind)
    rows = (await session.execute(stmt)).scalars()
    return {"items": [_dump(r) for r in rows]}


@router.get("/events")
async def audit_events(
    flag: str | None = Query(default=None, description="e.g. admin_bypass"),
    request_id: int | None = None,
    _=Depends(_read_audit),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Append-only transition events across all teams; `flag` filters (e.g. admin_bypass)."""
    stmt = (
        select(RequestEvent)
        .options(selectinload(RequestEvent.request))
        .order_by(RequestEvent.id.desc())
    )
    if request_id is not None:
        stmt = stmt.where(RequestEvent.request_id == request_id)
    if flag:
        # JSONB array contains the flag. `.contains` -> @> [flag].
        stmt = stmt.where(RequestEvent.flags.contains([flag]))
    rows = (await session.execute(stmt)).scalars()
    return {
        "items": [
            {
                "request_id": e.request_id,
                "owner_team": e.request.owner_team if e.request else None,
                "actor": e.actor,
                "from_state": e.from_state,
                "to_state": e.to_state,
                "note": e.note,
                "flags": e.flags,
                "at": e.at.isoformat() if e.at else None,
            }
            for e in rows
        ]
    }
