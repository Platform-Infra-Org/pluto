"""Task 2a: approval policy resolution + evaluation."""

import pytest

from app.requests.policy import (
    ApprovalPolicy,
    P,
    definition_default,
    is_satisfied,
    resolve_policy,
)

def_single = P("SINGLE")


def test_n_of_m_missing_n_is_never_satisfied():
    # Fail closed: a malformed N_OF_M must not be satisfied by any approvers.
    assert not is_satisfied(P("N_OF_M", n=None), ["alice"], False)
    assert not is_satisfied(P("N_OF_M", n=0), [], False)
    assert not is_satisfied(P("N_OF_M", n=0), ["alice"], False)


def test_from_dict_rejects_malformed_n_of_m():
    for bad in ({"mode": "N_OF_M"}, {"mode": "N_OF_M", "n": 0}, {"mode": "N_OF_M", "n": "x"}):
        with pytest.raises(ValueError):
            ApprovalPolicy.from_dict(bad)


def test_resolve_malformed_override_falls_back_to_default():
    # A malformed N_OF_M override is rejected and the definition default is used.
    resolved = resolve_policy(
        {"metadata": {"approvalPolicy": {"mode": "N_OF_M"}}}, def_single
    )
    assert resolved.mode == "SINGLE"


def test_resolve_raises_when_default_itself_malformed():
    with pytest.raises(ValueError):
        resolve_policy({"spec": {}}, P("N_OF_M", n=None))


def test_single_needs_one():
    assert not is_satisfied(P("SINGLE"), [], False)
    assert is_satisfied(P("SINGLE"), ["alice"], False)


def test_n_of_m_needs_distinct():
    assert not is_satisfied(P("N_OF_M", n=2), ["alice", "alice"], False)
    assert is_satisfied(P("N_OF_M", n=2), ["alice", "bob"], False)


def test_rbac_auto_approves_permitted_requester():
    assert is_satisfied(P("RBAC"), [], requester_can_approve=True)  # self-service
    assert not is_satisfied(P("RBAC"), [], requester_can_approve=False)


def test_rbac_satisfied_by_any_single_approval():
    assert is_satisfied(P("RBAC"), ["carol"], requester_can_approve=False)


def test_resolve_prefers_resource_override():
    assert resolve_policy({"metadata": {"approvalPolicy": {"mode": "RBAC"}}}, def_single).mode == "RBAC"


def test_resolve_falls_back_to_definition_default():
    assert resolve_policy({"spec": {}}, P("N_OF_M", n=3)).n == 3
    assert resolve_policy({}, def_single).mode == "SINGLE"


def test_definition_default_is_single_stub():
    # E08 seam: no Service Definition wired yet -> SINGLE.
    assert definition_default("anything").mode == "SINGLE"
