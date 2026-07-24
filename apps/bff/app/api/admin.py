"""Admin dashboard aggregation + management APIs (E09 Task 2).

One console over everything, admin-only: **every** endpoint enforces
`require_role("platform-admin")` server-side. These aggregate over the existing
epics' models/services (requests, catalog, service definitions, option sources)
— they never duplicate that logic, and the BFF still never writes Git.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import require_role
from app.auth.principal import Principal
from app.config import settings
from app.db import get_session
from app.models.request import Request
from app.models.resource import ResourceIndex
from app.requests import authz
from app.requests.state import IllegalTransition, add_approval, transition
from app.services import onboarding
from app.services.definition import ServiceDefinition
from app.services.fields.option_source import OptionSource

router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_role("platform-admin"))])


class NoteBody(BaseModel):
    note: str | None = None


class OwnershipBody(BaseModel):
    path_map: dict[str, str]
    default_team: str


def _dump_request(req: Request) -> dict:
    return {
        "id": req.id,
        "kind": req.kind,
        "action": req.action,
        "resource_type": req.resource_type,
        "resource_id": req.resource_id,
        "owner_team": req.owner_team,
        "requester": req.requester,
        "state": req.state,
        "approvals": req.approvals,
        "workflow_ref": req.workflow_ref,
        "failure": req.failure,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }


def _dump_def(d: ServiceDefinition) -> dict:
    return {
        "id": d.id, "name": d.name, "owner_team": d.owner_team,
        "status": d.status, "version": d.version, "category": d.category,
    }


@router.get("/overview")
async def overview(session: AsyncSession = Depends(get_session)) -> dict:
    """Health tiles aggregated across every subsystem."""
    by_state = dict(
        (await session.execute(
            select(Request.state, func.count()).group_by(Request.state)
        )).all()
    )
    pending_onboarding = await session.scalar(
        select(func.count()).select_from(Request).where(
            Request.kind == "SERVICE_ONBOARDING", Request.state == "PENDING_APPROVAL"
        )
    )
    succeeded = by_state.get("SUCCEEDED", 0)
    failed = by_state.get("FAILED", 0)
    terminal = succeeded + failed
    success_rate = round(succeeded / terminal, 3) if terminal else None
    stale = await session.scalar(
        select(func.count()).select_from(OptionSource).where(
            OptionSource.last_status == "stale"
        )
    )
    invalid = await session.scalar(
        select(func.count()).select_from(ResourceIndex).where(
            ResourceIndex.status == "invalid"
        )
    )
    return {
        "requests_by_state": by_state,
        "pending_onboarding": pending_onboarding or 0,
        "workflow_success_rate": success_rate,
        "option_source_staleness": stale or 0,
        "invalid_catalog_files": invalid or 0,
    }


@router.get("/requests")
async def all_requests(
    state: str | None = None,
    team: str | None = None,
    kind: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Every request across every team (filter by state/team/kind)."""
    stmt = select(Request).order_by(Request.id.desc())
    if state:
        stmt = stmt.where(Request.state == state)
    if team:
        stmt = stmt.where(Request.owner_team == team)
    if kind:
        stmt = stmt.where(Request.kind == kind)
    rows = (await session.execute(stmt)).scalars()
    return {"items": [_dump_request(r) for r in rows]}


@router.get("/services")
async def all_services(session: AsyncSession = Depends(get_session)) -> dict:
    """All Service Definitions + the pending onboarding queue."""
    defs = (await session.execute(
        select(ServiceDefinition).order_by(ServiceDefinition.id.desc())
    )).scalars()
    queue = (await session.execute(
        select(Request).where(
            Request.kind == "SERVICE_ONBOARDING", Request.state == "PENDING_APPROVAL"
        ).order_by(Request.id.desc())
    )).scalars()
    return {
        "definitions": [_dump_def(d) for d in defs],
        "onboarding_queue": [_dump_request(r) for r in queue],
    }


@router.get("/workflows")
async def workflows(session: AsyncSession = Depends(get_session)) -> dict:
    """Recent workflow runs (submitted requests) + failed steps."""
    stmt = (
        select(Request)
        .where(Request.workflow_ref.is_not(None))
        .order_by(Request.id.desc())
        .limit(100)
    )
    rows = (await session.execute(stmt)).scalars()
    return {"items": [_dump_request(r) for r in rows]}


@router.get("/rbac")
async def rbac() -> dict:
    """The configured group -> roles/teams map (read-only view)."""
    return {"role_group_map": settings.role_group_map}


@router.get("/ownership")
async def get_ownership() -> dict:
    """The ownership map used to resolve owner_team when metadata is absent."""
    return {"path_map": settings.ownership_path_map, "default_team": settings.default_owner_team}


@router.put("/ownership")
async def put_ownership(body: OwnershipBody) -> dict:
    """Edit the ownership map; the change takes effect in routing immediately —
    a new request with no metadata.ownerTeam resolves against the updated map.

    ponytail: mutates the in-process settings object (single-replica dev). For a
    multi-replica deployment persist this to a table and load it per resolve.
    """
    settings.ownership_path_map = dict(body.path_map)
    settings.default_owner_team = body.default_team
    return {"path_map": settings.ownership_path_map, "default_team": settings.default_owner_team}


@router.get("/option-sources")
async def option_sources(session: AsyncSession = Depends(get_session)) -> dict:
    """Poller health per source: last sync + status (ok/stale/pending)."""
    rows = (await session.execute(select(OptionSource).order_by(OptionSource.id))).scalars()
    return {
        "items": [
            {
                "id": s.id,
                "url": s.url,
                "method": s.method,
                "last_status": s.last_status,
                "stale": s.last_status == "stale",
                "last_synced_at": s.last_synced_at.isoformat() if s.last_synced_at else None,
                "refresh_interval": s.refresh_interval,
            }
            for s in rows
        ]
    }


async def _load_onboarding(session: AsyncSession, request_id: int) -> Request:
    stmt = (
        select(Request)
        .where(Request.id == request_id, Request.kind == "SERVICE_ONBOARDING")
        .options(selectinload(Request.events))
    )
    req = (await session.execute(stmt)).scalar_one_or_none()
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "onboarding request not found")
    return req


@router.post("/services/onboarding/{request_id}/approve")
async def approve_onboarding(
    request_id: int,
    body: NoteBody,
    principal: Principal = Depends(require_role("platform-admin")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Approve an onboarding request from the console (reuses the E08 lane)."""
    req = await _load_onboarding(session, request_id)
    if not authz.can_approve(principal, req):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "cannot self-approve onboarding")
    try:
        add_approval(req, principal.sub, note=body.note)
    except IllegalTransition as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await session.commit()
    activated = await onboarding.activate(session, req) if req.state == "APPROVED" else None
    return {"state": req.state, "definition_status": activated.status if activated else None}


@router.post("/services/onboarding/{request_id}/reject")
async def reject_onboarding(
    request_id: int,
    body: NoteBody,
    principal: Principal = Depends(require_role("platform-admin")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Reject an onboarding request; the definition returns to its owner as DRAFT."""
    req = await _load_onboarding(session, request_id)
    try:
        transition(req, "reject", principal.sub, body.note)
    except IllegalTransition as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await session.commit()
    d = await onboarding.return_to_owner(session, req)
    return {"state": req.state, "definition_status": d.status}
