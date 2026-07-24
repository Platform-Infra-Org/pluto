"""Task 2a: approval policy resolution + evaluation."""

from app.requests.policy import P, definition_default, is_satisfied, resolve_policy

def_single = P("SINGLE")


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
