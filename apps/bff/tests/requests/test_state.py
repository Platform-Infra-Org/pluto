"""Task 2b: state machine legal edges + policy-satisfied guard."""

import pytest

from app.models.request import Request
from app.requests.policy import P
from app.requests.state import IllegalTransition, add_approval, transition


def make_request(policy=P("SINGLE"), state="PENDING_APPROVAL", requester="bob"):
    return Request(
        kind="RESOURCE_CHANGE",
        action="UPDATE",
        resource_type="database",
        owner_team="payments",
        payload={},
        requester=requester,
        state=state,
        approval_policy=policy.as_dict(),
        approvals=[],
    )


def test_approval_fires_when_policy_satisfied():
    r = make_request(policy=P("SINGLE"))
    add_approval(r, "alice")
    assert r.state == "APPROVED"
    assert r.events[-1].to_state == "APPROVED"


def test_n_of_m_waits_for_quorum():
    r = make_request(policy=P("N_OF_M", n=2))
    add_approval(r, "alice")
    assert r.state == "PENDING_APPROVAL"  # one short
    add_approval(r, "alice")  # duplicate — no progress
    assert r.state == "PENDING_APPROVAL"
    add_approval(r, "bob")
    assert r.state == "APPROVED"
    assert len(r.approvals) == 2  # distinct only


def test_rbac_auto_approve_via_flag():
    r = make_request(policy=P("RBAC"))
    add_approval(r, "bob", requester_can_approve=True)  # requester self-serves
    assert r.state == "APPROVED"


def test_illegal_transition_raises():
    with pytest.raises(IllegalTransition):
        transition(make_request(state="SUCCEEDED"), "approve", "x", None)


def test_reject_and_discard_edges():
    r = make_request()
    transition(r, "reject", "alice", "no")
    assert r.state == "REJECTED"
    d = make_request(state="DRAFT")
    transition(d, "submit", "bob", None)
    assert d.state == "PENDING_APPROVAL"


def test_every_transition_writes_event():
    r = make_request()
    transition(r, "reject", "alice", "nope")
    ev = r.events[-1]
    assert ev.from_state == "PENDING_APPROVAL"
    assert ev.to_state == "REJECTED"
    assert ev.actor == "alice"
    assert ev.note == "nope"
