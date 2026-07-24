"""Task 3: approver authorization, separation of duties, admin bypass."""

import pytest

from app.auth.principal import Principal
from app.models.request import Request
from app.requests.authz import NotPermitted, admin_bypass, can_approve
from app.requests.policy import P


def princ(sub, teams=(), roles=()):
    return Principal(sub=sub, username=sub, groups=[], roles=set(roles), teams=set(teams))


def req(policy=P("SINGLE"), requester="bob", owner_team="payments", state="PENDING_APPROVAL"):
    return Request(
        kind="RESOURCE_CHANGE",
        action="UPDATE",
        resource_type="database",
        owner_team=owner_team,
        payload={},
        requester=requester,
        state=state,
        approval_policy=policy.as_dict(),
        approvals=[],
    )


def test_owner_team_member_can_approve_single():
    assert can_approve(princ("alice", teams=["payments"]), req())


def test_outsider_cannot_approve():
    assert not can_approve(princ("mallory", teams=["search"]), req())


def test_requester_cannot_self_approve_single():
    assert not can_approve(princ("bob", teams=["payments"]), req(requester="bob"))


def test_requester_cannot_self_approve_n_of_m():
    assert not can_approve(princ("bob", teams=["payments"]), req(policy=P("N_OF_M", n=2), requester="bob"))


def test_rbac_permitted_requester_can_self_approve():
    r = req(policy=P("RBAC"), requester="bob")
    assert can_approve(princ("bob", teams=["payments"]), r)  # self-service allowed in RBAC


def test_rbac_unpermitted_requester_cannot():
    r = req(policy=P("RBAC"), requester="bob")
    assert not can_approve(princ("bob", teams=["search"]), r)


def test_platform_admin_can_approve_others_request():
    assert can_approve(princ("adm", roles=["platform-admin"]), req())


def test_admin_bypass_approves_and_logs_reason():
    r = req(policy=P("N_OF_M", n=3))
    admin_bypass(r, princ("adm", roles=["platform-admin"]), "prod incident")
    assert r.state == "APPROVED"
    ev = r.events[-1]
    assert ev.flags == ["admin_bypass"]
    assert ev.note == "prod incident"
    assert ev.actor == "adm"


def test_admin_bypass_requires_reason():
    with pytest.raises(ValueError):
        admin_bypass(req(), princ("adm", roles=["platform-admin"]), "")


def test_admin_bypass_requires_admin_role():
    with pytest.raises(NotPermitted):
        admin_bypass(req(), princ("alice", teams=["payments"]), "because")
