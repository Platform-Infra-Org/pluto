"""Requests & approvals API (E05, RESOURCE_CHANGE lane).

All authorization is enforced here, server-side, on every transition. This epic
stops at APPROVED — nothing is submitted to Argo (that's E06).
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.catalog.ownership import resolve_owner_team
from app.db import get_session
from app.execution.runner import schedule_execution
from app.models.request import Request, RequestEvent
from app.models.resource import ResourceIndex
from app.notifications import events
from app.requests import authz
from app.requests.policy import RBAC, ApprovalPolicy, resolve_policy
from app.requests.schema_forms import PayloadInvalid, is_stale, validate_payload
from app.requests.state import IllegalTransition, add_approval, transition
from app.services import definition as service_def

router = APIRouter(prefix="/api/requests")

# Roles that see every request regardless of team/requester.
_AUDIT_ROLES = {"platform-admin", "auditor"}


def _can_see(principal: Principal, req: Request) -> bool:
    """Read visibility: own request, owner-team member, or admin/auditor."""
    return (
        req.requester == principal.sub
        or req.owner_team in principal.teams
        or bool(_AUDIT_ROLES & principal.roles)
    )


class SubmitBody(BaseModel):
    action: Literal["CREATE", "UPDATE", "DELETE"]
    resource_type: str
    resource_id: int | None = None
    payload: dict = {}
    kind: Literal["RESOURCE_CHANGE"] = "RESOURCE_CHANGE"


class ApproveBody(BaseModel):
    note: str | None = None
    confirm_stale: bool = False


class RejectBody(BaseModel):
    note: str | None = None


class BypassBody(BaseModel):
    reason: str = ""


def _dump(req: Request, principal: Principal | None = None) -> dict:
    return {
        "id": req.id,
        # Display-only signal for the SPA; the transition endpoints re-check authz.
        "can_approve": authz.can_approve(principal, req) if principal else False,
        "kind": req.kind,
        "action": req.action,
        "resource_type": req.resource_type,
        "resource_id": req.resource_id,
        "owner_team": req.owner_team,
        "payload": req.payload,
        "requester": req.requester,
        "state": req.state,
        "approval_policy": req.approval_policy,
        "approvals": req.approvals,
        "base_git_sha": req.base_git_sha,
        "workflow_ref": req.workflow_ref,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "events": [
            {
                "at": e.at.isoformat() if e.at else None,
                "actor": e.actor,
                "from_state": e.from_state,
                "to_state": e.to_state,
                "note": e.note,
                "flags": e.flags,
            }
            for e in req.events
        ],
    }


async def _load(session: AsyncSession, request_id: int) -> Request:
    stmt = (
        select(Request)
        .where(Request.id == request_id)
        .options(selectinload(Request.events))
    )
    req = (await session.execute(stmt)).scalar_one_or_none()
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "request not found")
    return req


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_request(
    body: SubmitBody,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    resource: ResourceIndex | None = None
    if body.resource_id is not None:
        resource = await session.get(ResourceIndex, body.resource_id)
        if resource is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "target resource not found")

    # Policy + ownership resolved at submit from the resource's own JSON (override)
    # falling back to the Service Definition default (E08). Pin-until-migrated: an
    # UPDATE/DELETE validates against the resource's pinned definition version.
    resource_payload = resource.payload if resource else body.payload
    owner_team = (
        resource.owner_team if resource else resolve_owner_team(body.payload, "")
    )
    pinned = resource.definition_version if resource else None
    default_policy = ApprovalPolicy.from_dict(
        await service_def.effective_policy(session, body.resource_type, pinned)
    )
    policy = resolve_policy(resource_payload, default_policy)
    schema = await service_def.payload_schema(session, body.resource_type, pinned)

    try:
        validate_payload(body.resource_type, body.action, body.payload, schema)
    except PayloadInvalid as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    req = Request(
        kind=body.kind,
        action=body.action,
        resource_type=body.resource_type,
        resource_id=body.resource_id,
        owner_team=owner_team,
        payload=body.payload,
        requester=principal.sub,
        state="PENDING_APPROVAL",
        approval_policy=policy.as_dict(),
        approvals=[],
        base_git_sha=resource.git_sha if resource else None,
    )
    req.events.append(
        RequestEvent(actor=principal.sub, from_state=None, to_state="PENDING_APPROVAL", note="submit")
    )

    # RBAC self-service: a permitted requester auto-approves their own request.
    if policy.mode == RBAC and authz.can_approve(principal, req):
        add_approval(req, principal.sub, note="rbac auto-approve", requester_can_approve=True)

    session.add(req)
    await session.commit()
    await session.refresh(req, ["events"])
    # Notify: still pending -> owner-team approvers; auto-approved (RBAC) -> requester.
    if req.state == "PENDING_APPROVAL":
        await events.notify_safe(events.request_submitted, session, req)
    elif req.state == "APPROVED":
        await events.notify_safe(events.request_approved, session, req)
    return _dump(req)


@router.get("")
async def list_requests(
    mine: int = 0,
    queue: int = 0,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = select(Request).options(selectinload(Request.events)).order_by(Request.id.desc())
    if mine:
        stmt = stmt.where(Request.requester == principal.sub)
    elif queue:
        stmt = stmt.where(Request.state == "PENDING_APPROVAL")
    elif not (_AUDIT_ROLES & principal.roles):
        # Default view: own requests or ones owned by a team the caller is on.
        stmt = stmt.where(
            or_(
                Request.requester == principal.sub,
                Request.owner_team.in_(list(principal.teams)),
            )
        )
    rows = list((await session.execute(stmt)).scalars())
    if queue:
        rows = [r for r in rows if authz.can_approve(principal, r)]
    return {"items": [_dump(r, principal) for r in rows]}


@router.get("/{request_id}")
async def get_request(
    request_id: int,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    req = await _load(session, request_id)
    # 404 (not 403) for requests the caller may not see — don't reveal existence.
    if not _can_see(principal, req):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "request not found")
    return _dump(req, principal)


async def _reject_if_stale(session: AsyncSession, req: Request, confirm: bool) -> None:
    if req.resource_id is None:
        return
    resource = await session.get(ResourceIndex, req.resource_id)
    if resource is None:
        # Target vanished from the index — cannot be approved as "fresh", and
        # confirm_stale must not override a resource that no longer exists.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "target resource no longer exists; cannot approve",
        )
    current_sha = resource.git_sha
    if is_stale(req, current_sha) and not confirm:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "request is stale; re-confirm to approve"
        )


@router.post("/{request_id}/approve")
async def approve_request(
    request_id: int,
    body: ApproveBody,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    req = await _load(session, request_id)
    if not authz.can_approve(principal, req):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not authorized to approve")
    await _reject_if_stale(session, req, body.confirm_stale)
    try:
        add_approval(req, principal.sub, note=body.note)
    except IllegalTransition as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await session.commit()
    await session.refresh(req, ["events"])
    if req.state == "APPROVED":
        await events.notify_safe(events.request_approved, session, req)
        schedule_execution(req.id)  # close the loop: submit + watch (gated on Argo config)
    return _dump(req)


@router.post("/{request_id}/reject")
async def reject_request(
    request_id: int,
    body: RejectBody,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    req = await _load(session, request_id)
    if not authz.can_approve(principal, req):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not authorized to reject")
    try:
        transition(req, "reject", principal.sub, body.note)
    except IllegalTransition as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await session.commit()
    await session.refresh(req, ["events"])
    await events.notify_safe(events.request_rejected, session, req)
    return _dump(req)


@router.post("/{request_id}/bypass")
async def bypass_request(
    request_id: int,
    body: BypassBody,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    req = await _load(session, request_id)
    try:
        authz.admin_bypass(req, principal, body.reason)
    except authz.NotPermitted as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except IllegalTransition as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await session.commit()
    await session.refresh(req, ["events"])
    if req.state == "APPROVED":
        await events.notify_safe(events.request_approved, session, req)
        schedule_execution(req.id)  # bypass also reaches APPROVED -> execute
    return _dump(req)
