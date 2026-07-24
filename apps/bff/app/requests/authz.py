"""Approver authorization + admin bypass for the RESOURCE_CHANGE lane (Task 3).

Enforced server-side on every transition. A requester never counts as their own
approver EXCEPT in RBAC self-service mode. `platform-admin` bypass always writes
an audited `RequestEvent(flags=["admin_bypass"])` with a required reason.
"""

from app.auth.principal import Principal
from app.models.request import Request
from app.requests.policy import RBAC
from app.requests.state import transition

ADMIN_ROLE = "platform-admin"


class NotPermitted(Exception):
    """Actor lacks the authorization for the attempted action (API -> 403)."""


def _rbac_permitted(principal: Principal, req: Request) -> bool:
    """Whether RBAC grants this principal approve on the resource — may be the
    requester (self-service). ponytail: approve-grant is proxied by owner-team /
    admin membership until E08 formalizes per-resource RBAC approve grants.
    """
    return req.owner_team in principal.teams or ADMIN_ROLE in principal.roles


def can_approve(principal: Principal, req: Request) -> bool:
    """May `principal` approve `req`, given its resolved policy mode?"""
    mode = req.approval_policy.get("mode")
    if mode == RBAC:
        return _rbac_permitted(principal, req)  # requester allowed (self-service)
    # SINGLE / N_OF_M: owner-team member or admin, but never the requester.
    if principal.sub == req.requester:
        return False
    return req.owner_team in principal.teams or ADMIN_ROLE in principal.roles


def admin_bypass(req: Request, admin: Principal, reason: str) -> Request:
    """Approve-and-override in a single action; always audit-logged with a reason."""
    if ADMIN_ROLE not in admin.roles:
        raise NotPermitted("admin bypass requires platform-admin")
    if not reason or not reason.strip():
        raise ValueError("admin bypass requires a reason")
    return transition(req, "approve", admin.sub, reason, flags=["admin_bypass"])
