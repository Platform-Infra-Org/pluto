"""Request state machine: legal edges + policy-satisfied guard (Task 2b).

Every transition appends a `RequestEvent` (append-only audit). This epic stops
at APPROVED — no edges out of APPROVED (execution is E06).
"""

from datetime import UTC, datetime

from app.models.request import Request, RequestEvent
from app.requests.policy import ApprovalPolicy, is_satisfied

# (from_state, action) -> to_state. RESOURCE_CHANGE lane; onboarding is E08.
_EDGES: dict[tuple[str, str], str] = {
    ("DRAFT", "submit"): "PENDING_APPROVAL",
    ("DRAFT", "discard"): "DISCARDED",
    ("PENDING_APPROVAL", "approve"): "APPROVED",
    ("PENDING_APPROVAL", "reject"): "REJECTED",
    ("PENDING_APPROVAL", "discard"): "DISCARDED",
    # Execution (E06): approval -> Argo submit -> terminal.
    ("APPROVED", "execute"): "EXECUTING",
    ("EXECUTING", "succeed"): "SUCCEEDED",
    ("EXECUTING", "fail"): "FAILED",
}


class IllegalTransition(Exception):
    """The requested action is not a legal edge from the request's current state."""


def transition(
    req: Request, action: str, actor: str, note: str | None, flags: list | None = None
) -> Request:
    """Move `req` along a legal edge and write an audit event; else raise."""
    target = _EDGES.get((req.state, action))
    if target is None:
        raise IllegalTransition(f"cannot {action} from {req.state}")
    frm = req.state
    req.state = target
    req.events.append(
        RequestEvent(
            at=datetime.now(UTC),
            actor=actor,
            from_state=frm,
            to_state=target,
            note=note,
            flags=flags or [],
        )
    )
    return req


def add_approval(
    req: Request,
    approver: str,
    note: str | None = None,
    requester_can_approve: bool = False,
) -> Request:
    """Append a distinct approver; fire APPROVED once the policy is satisfied.

    Authorization (who may approve, separation of duties) is enforced upstream
    in `authz.can_approve` — this is the pure state helper.
    """
    if req.state != "PENDING_APPROVAL":
        raise IllegalTransition(f"cannot approve from {req.state}")
    if approver not in {a["approver_id"] for a in req.approvals}:
        req.approvals = req.approvals + [
            {"approver_id": approver, "at": datetime.now(UTC).isoformat(), "note": note}
        ]
    policy = ApprovalPolicy.from_dict(req.approval_policy)
    if req.state == "PENDING_APPROVAL" and is_satisfied(
        policy, req.approvals, requester_can_approve
    ):
        transition(req, "approve", approver, note)
    return req
