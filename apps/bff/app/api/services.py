"""Service Definition + onboarding API (E08 Tasks 2 & 6).

Service owners author/save DRAFT definitions and submit them for onboarding;
`platform-admin` approves/rejects. Onboarding reuses the E05 state machine +
audit trail via `authz.can_approve` (kind-aware) and `state.add_approval`.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import current_principal, require_role
from app.auth.principal import Principal
from app.db import get_session
from app.models.request import Request
from app.requests import authz
from app.requests.state import IllegalTransition, add_approval, transition
from app.generator.generate import GenerationError
from app.services import compose, definition as service_def
from app.services import onboarding
from app.services.definition import DRAFT, ServiceDefinition

router = APIRouter(prefix="/api/services")


class DefinitionBody(BaseModel):
    name: str
    category: str = ""
    owner_team: str | None = None
    form_schema: dict = {}
    ui_schema: dict = {}
    workflow_binding: dict = {}
    approval_policy: dict = {"mode": "SINGLE"}
    git_path: str = ""


class NoteBody(BaseModel):
    note: str | None = None


class EditBody(BaseModel):
    graphs: dict  # full per-verb graph set (CB03 wire shape); replaces the current graphs


def _dump_def(d: ServiceDefinition) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "category": d.category,
        "owner_team": d.owner_team,
        "form_schema": d.form_schema,
        "ui_schema": d.ui_schema,
        "workflow_binding": d.workflow_binding,
        "approval_policy": d.approval_policy,
        "graphs": d.graphs,
        "generated": d.generated,
        "block_versions": d.block_versions,
        "git_path": d.git_path,
        "status": d.status,
        "version": d.version,
    }


@router.get("/type-schema/{resource_type}")
async def get_type_schema(
    resource_type: str,
    _: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Form JSON Schema + ui-schema for a type, from its ACTIVE ServiceDefinition."""
    d = await service_def.resolve(session, resource_type)
    if d is None:
        return {"resource_type": resource_type, "form_schema": {"properties": {}}, "ui_schema": {}}
    return {
        "resource_type": resource_type,
        "form_schema": d.form_schema,
        "ui_schema": d.ui_schema,
        "version": d.version,
    }


@router.post("/definitions", status_code=status.HTTP_201_CREATED)
async def create_definition(
    body: DefinitionBody,
    principal: Principal = Depends(require_role("service-owner")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Save a DRAFT definition. A new version bumps (pin-until-migrated)."""
    owner_team = body.owner_team or (sorted(principal.teams)[0] if principal.teams else "")
    if owner_team and owner_team not in principal.teams:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not a member of the owner team")
    version = await service_def.next_version(session, body.name)
    d = ServiceDefinition(
        name=body.name,
        category=body.category,
        owner_team=owner_team,
        form_schema=body.form_schema,
        ui_schema=body.ui_schema,
        workflow_binding=body.workflow_binding,
        approval_policy=body.approval_policy,
        git_path=body.git_path or f"resources/{body.name}/",
        status=service_def.DRAFT,
        version=version,
    )
    session.add(d)
    await session.commit()
    return _dump_def(d)


@router.get("/definitions")
async def list_definitions(
    mine: int = 0,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """My team's definitions with status (DRAFT/PENDING_ONBOARDING/ACTIVE/RETIRED)."""
    stmt = select(ServiceDefinition).order_by(ServiceDefinition.id.desc())
    if mine or "platform-admin" not in principal.roles:
        stmt = stmt.where(ServiceDefinition.owner_team.in_(list(principal.teams) or [""]))
    rows = list((await session.execute(stmt)).scalars())
    return {"items": [_dump_def(d) for d in rows]}


async def _own_definition(
    session: AsyncSession, definition_id: int, principal: Principal
) -> ServiceDefinition:
    d = await session.get(ServiceDefinition, definition_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "definition not found")
    if d.owner_team not in principal.teams:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not the owning team")
    return d


@router.post("/definitions/{definition_id}/submit")
async def submit_definition(
    definition_id: int,
    principal: Principal = Depends(require_role("service-owner")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Submit a DRAFT for admin onboarding -> SERVICE_ONBOARDING request (E05)."""
    d = await _own_definition(session, definition_id, principal)
    if d.status not in (service_def.DRAFT,):
        raise HTTPException(status.HTTP_409_CONFLICT, f"cannot submit from {d.status}")
    req = await onboarding.submit_onboarding(session, d, principal.sub)
    return {"request_id": req.id, "definition_status": d.status, "state": req.state}


@router.post("/definitions/{definition_id}/edit")
async def edit_definition(
    definition_id: int,
    body: EditBody,
    principal: Principal = Depends(require_role("service-owner")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Compose/edit a definition's per-verb graphs, then resubmit for onboarding.

    A still-DRAFT definition is edited in place. A definition that already went
    through onboarding (ACTIVE/PENDING/RETIRED) **forks a new bumped version**
    (pin-until-migrated: existing resources keep resolving their pinned version).
    Verbs are opt-in — `graphs` is the full new set (add/remove a verb by including
    or omitting it). Every edit regenerates (CB02) and re-enters SERVICE_ONBOARDING.
    """
    src = await _own_definition(session, definition_id, principal)
    if src.status == DRAFT:
        target = src
    else:
        target = ServiceDefinition(
            name=src.name,
            category=src.category,
            owner_team=src.owner_team,
            form_schema=src.form_schema,
            ui_schema=src.ui_schema,
            workflow_binding=src.workflow_binding,
            approval_policy=src.approval_policy,
            git_path=src.git_path,
            status=DRAFT,
            version=await service_def.next_version(session, src.name),
        )
    try:
        await compose.save_graphs(session, target, body.graphs)
    except GenerationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    req = await onboarding.submit_onboarding(session, target, principal.sub)
    return {"version": target.version, "request_id": req.id, "definition": _dump_def(target)}


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


@router.get("/onboarding")
async def onboarding_queue(
    principal: Principal = Depends(require_role("platform-admin")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Admin queue: pending onboarding requests with form + binding + policy preview."""
    stmt = (
        select(Request)
        .where(
            Request.kind == "SERVICE_ONBOARDING",
            Request.state == "PENDING_APPROVAL",
        )
        .options(selectinload(Request.events))
        .order_by(Request.id.desc())
    )
    items = []
    for req in (await session.execute(stmt)).scalars():
        d = await session.get(ServiceDefinition, req.payload.get("definition_id"))
        items.append(
            {
                "request_id": req.id,
                "requester": req.requester,
                "state": req.state,
                "definition": _dump_def(d) if d else None,
            }
        )
    return {"items": items}


@router.post("/onboarding/{request_id}/approve")
async def approve_onboarding(
    request_id: int,
    body: NoteBody,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Admin approves. Reuses E05 add_approval; on APPROVED the definition goes ACTIVE."""
    req = await _load_onboarding(session, request_id)
    if not authz.can_approve(principal, req):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "onboarding requires platform-admin and no self-approval",
        )
    try:
        add_approval(req, principal.sub, note=body.note)
    except IllegalTransition as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await session.commit()
    activated = None
    if req.state == "APPROVED":
        activated = await onboarding.activate(session, req)
    return {"state": req.state, "definition_status": activated.status if activated else None}


@router.post("/onboarding/{request_id}/reject")
async def reject_onboarding(
    request_id: int,
    body: NoteBody,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Admin rejects; the definition returns to the owner as a DRAFT with notes."""
    req = await _load_onboarding(session, request_id)
    if not authz.can_approve(principal, req):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "onboarding requires platform-admin")
    try:
        transition(req, "reject", principal.sub, body.note)
    except IllegalTransition as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await session.commit()
    d = await onboarding.return_to_owner(session, req)
    return {"state": req.state, "definition_status": d.status}
