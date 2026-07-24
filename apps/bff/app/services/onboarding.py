"""Service onboarding lane — admin approval → ACTIVE (E08 Task 6).

Onboarding reuses the E05 `Request` state machine with `kind=SERVICE_ONBOARDING`;
only the approver-resolution rule differs (`authz.can_approve` branches on kind →
`platform-admin`, never the submitting owner). Drafts live in Postgres until
submitted; approving flips the definition to ACTIVE so it becomes requestable.

DEFERRED live seam: in production the approval triggers a workflow that commits
the definition JSON to Git (the sole Git writer) and the catalog indexes it. No
cluster here, so we persist ACTIVE via the approval path directly — the BFF never
writes Git.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.request import Request, RequestEvent
from app.services.definition import (
    ACTIVE,
    DRAFT,
    PENDING_ONBOARDING,
    ServiceDefinition,
)


async def submit_onboarding(
    session: AsyncSession, definition: ServiceDefinition, requester_sub: str
) -> Request:
    """Submit a DRAFT definition for admin onboarding. Creates the E05 request."""
    definition.status = PENDING_ONBOARDING
    req = Request(
        kind="SERVICE_ONBOARDING",
        action="CREATE",
        resource_type=definition.name,
        owner_team=definition.owner_team,
        payload={"definition_id": definition.id, "name": definition.name},
        requester=requester_sub,
        state="PENDING_APPROVAL",
        approval_policy={"mode": "SINGLE"},  # admin sign-off
        approvals=[],
    )
    req.events.append(
        RequestEvent(
            actor=requester_sub,
            from_state=None,
            to_state="PENDING_APPROVAL",
            note="submit onboarding",
        )
    )
    session.add(req)
    await session.commit()
    await session.refresh(req, ["events"])
    return req


async def _definition_of(session: AsyncSession, req: Request) -> ServiceDefinition:
    d = await session.get(ServiceDefinition, req.payload["definition_id"])
    if d is None:
        raise ValueError(f"definition {req.payload['definition_id']} not found")
    return d


async def activate(session: AsyncSession, req: Request) -> ServiceDefinition:
    """On approval, make the definition ACTIVE + requestable.

    DEFERRED: the live path is a workflow that commits the JSON to Git and the
    catalog indexer that flips status. Here we set ACTIVE directly.
    """
    d = await _definition_of(session, req)
    d.status = ACTIVE
    await session.commit()
    return d


async def return_to_owner(session: AsyncSession, req: Request) -> ServiceDefinition:
    """On reject, the definition goes back to the owner as a DRAFT (notes on the request)."""
    d = await _definition_of(session, req)
    d.status = DRAFT
    await session.commit()
    return d
