"""Admin dashboard aggregation + management APIs (E09 Task 2).

One console over everything, admin-only: **every** endpoint enforces
`require_role("platform-admin")` server-side. These aggregate over the existing
epics' models/services (requests, catalog, service definitions, option sources)
— they never duplicate that logic, and the BFF still never writes Git.
"""

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.requests import Request as HttpRequest

from app.auth.deps import require_role
from app.auth.principal import Principal
from app.config import settings
from app.db import get_session
from app.models.group import Group
from app.models.project import Project
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
    default_team: str = Field(min_length=1)


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
    by_state: dict[str, int] = {
        state_: count
        for state_, count in (
            await session.execute(
                select(Request.state, func.count()).group_by(Request.state)
            )
        ).all()
    }
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


# --- F3: local groups registry (import) + projects mapped to a group ---------


def _dump_group(g: Group) -> dict:
    return {"id": g.id, "name": g.name, "source": g.source, "description": g.description}


def _dump_project(p: Project) -> dict:
    return {"id": p.id, "name": p.name, "group_name": p.group_name, "description": p.description}


def _parse_group_import(raw: str, fmt: str | None) -> list[dict]:
    """Parse a JSON or CSV import body into ``[{name, description}]``.

    JSON: ``["a", "b"]`` or ``[{"name": ..., "description": ...}]``.
    CSV: a ``name`` column, optional ``description``.
    Detection: explicit ``fmt`` wins, else sniff (a leading ``[``/``{`` is JSON).
    Raises ``ValueError`` on anything malformed so the caller returns 422.
    """
    text = raw.strip()
    if not text:
        raise ValueError("empty import body")
    is_json = fmt == "json" or (fmt != "csv" and text[0] in "[{")
    out: list[dict] = []
    if is_json:
        data = json.loads(text)  # raises ValueError subclass on bad JSON
        if not isinstance(data, list):
            raise ValueError("JSON import must be an array")
        for item in data:
            name: object
            if isinstance(item, str):
                name, desc = item, None
            elif isinstance(item, dict):
                name, desc = item.get("name"), item.get("description")
            else:
                raise ValueError("each item must be a string or an object")
            if not isinstance(name, str) or not name.strip():
                raise ValueError("each group needs a non-empty name")
            out.append({"name": name.strip(), "description": desc})
        return out
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or "name" not in reader.fieldnames:
        raise ValueError("CSV import needs a 'name' column")
    for row in reader:
        name = (row.get("name") or "").strip()
        if not name:
            raise ValueError("CSV row is missing a name")
        out.append({"name": name, "description": (row.get("description") or None)})
    return out


@router.get("/groups")
async def list_groups(session: AsyncSession = Depends(get_session)) -> dict:
    """The local groups registry (imported + any other locally-tracked groups)."""
    rows = (await session.execute(select(Group).order_by(Group.name))).scalars()
    return {"items": [_dump_group(g) for g in rows]}


@router.post("/groups/import")
async def import_groups(
    request: HttpRequest,
    format: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Import groups from an uploaded JSON or CSV body; upsert by name (idempotent).

    Returns ``{imported, skipped}``. Malformed input is a 422, never a 500.
    """
    raw = (await request.body()).decode("utf-8", "replace")
    try:
        parsed = _parse_group_import(raw, format)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    existing = set((await session.execute(select(Group.name))).scalars())
    imported = skipped = 0
    for item in parsed:
        if item["name"] in existing:  # idempotent: skip names already present (incl. dupes in body)
            skipped += 1
            continue
        session.add(Group(name=item["name"], source="import", description=item["description"]))
        existing.add(item["name"])
        imported += 1
    await session.commit()
    return {"imported": imported, "skipped": skipped}


class ProjectBody(BaseModel):
    name: str = Field(min_length=1)
    group_name: str = Field(min_length=1)  # non-empty; may be an LDAP-native group not in the registry
    description: str | None = None


@router.get("/projects")
async def list_projects(session: AsyncSession = Depends(get_session)) -> dict:
    """All projects and the group each maps to."""
    rows = (await session.execute(select(Project).order_by(Project.name))).scalars()
    return {"items": [_dump_project(p) for p in rows]}


@router.post("/projects", status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectBody, session: AsyncSession = Depends(get_session)
) -> dict:
    """Create a project mapping to a group. 409 on duplicate name. The group need
    not be in the local registry (LDAP-native); ``group_known`` flags whether it is.
    """
    if await session.scalar(select(Project).where(Project.name == body.name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "project name already exists")
    known = await session.scalar(select(Group).where(Group.name == body.group_name))
    project = Project(name=body.name, group_name=body.group_name, description=body.description)
    session.add(project)
    await session.commit()
    return {**_dump_project(project), "group_known": known is not None}


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int, session: AsyncSession = Depends(get_session)
) -> None:
    project = await session.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "project not found")
    await session.delete(project)
    await session.commit()
