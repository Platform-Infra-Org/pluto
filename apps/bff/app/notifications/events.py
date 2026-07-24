"""Domain event -> notification recipients (E07 Task 2).

Thin subscribers called from the E05 request transitions and the E06 watcher's
terminal states. Each maps one event to the right recipient key:

    request submitted   -> owner-team approvers   (APPROVAL_NEEDED)
    approved / rejected  -> the requester          (REQUEST_APPROVED/REJECTED)
    workflow done/failed -> the requester          (WORKFLOW_SUCCEEDED/FAILED)

Best-effort: a notification failure must never break the request transition, so
call sites wrap these in `notify_safe`.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.request import Request
from app.notifications import service

log = logging.getLogger(__name__)

_what = lambda r: f"{r.action} {r.resource_type}"  # noqa: E731 — tiny label helper


async def request_submitted(session: AsyncSession, req: Request) -> None:
    await service.notify(
        session, req.owner_team, "APPROVAL_NEEDED", req.id,
        f"Approval needed: {_what(req)}",
        f"{req.requester} requested {_what(req)} for team {req.owner_team}.",
    )


async def request_approved(session: AsyncSession, req: Request) -> None:
    await service.notify(
        session, req.requester, "REQUEST_APPROVED", req.id,
        f"Approved: {_what(req)}", "Your request was approved.",
    )


async def request_rejected(session: AsyncSession, req: Request) -> None:
    await service.notify(
        session, req.requester, "REQUEST_REJECTED", req.id,
        f"Rejected: {_what(req)}", "Your request was rejected.",
    )


async def workflow_succeeded(session: AsyncSession, req: Request) -> None:
    await service.notify(
        session, req.requester, "WORKFLOW_SUCCEEDED", req.id,
        f"Succeeded: {_what(req)}", "Your change was applied successfully.",
    )


async def workflow_failed(session: AsyncSession, req: Request) -> None:
    step = (req.failure or {}).get("node") or "the workflow"
    await service.notify(
        session, req.requester, "WORKFLOW_FAILED", req.id,
        f"Failed: {_what(req)}", f"Your change failed at {step}.",
    )


async def notify_safe(handler, session: AsyncSession, req: Request) -> None:
    """Run a subscriber without letting a notification error break the caller."""
    try:
        await handler(session, req)
    except Exception:  # noqa: BLE001 — notifications are best-effort
        log.exception("notification for request %s failed", getattr(req, "id", "?"))
