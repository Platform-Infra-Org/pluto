"""Task 4: payload validation against the type schema + staleness guard."""

import pytest

from app.models.request import Request
from app.requests.schema_forms import PayloadInvalid, is_stale, validate_payload


def test_valid_payload_passes():
    validate_payload("database", "UPDATE", {"spec": {"engine": "pg"}})  # no raise


def test_invalid_payload_rejected():
    with pytest.raises(PayloadInvalid):
        validate_payload("database", "UPDATE", {"no_spec": True})


def test_delete_skips_payload_validation():
    validate_payload("database", "DELETE", {})  # delete only needs a target


def test_stale_when_base_sha_differs():
    r = Request(
        kind="RESOURCE_CHANGE", action="UPDATE", resource_type="database",
        owner_team="t", payload={}, requester="bob", state="PENDING_APPROVAL",
        approval_policy={}, approvals=[], base_git_sha="old",
    )
    assert is_stale(r, current_git_sha="new")
    assert not is_stale(r, current_git_sha="old")


def test_create_without_base_sha_not_stale():
    r = Request(
        kind="RESOURCE_CHANGE", action="CREATE", resource_type="database",
        owner_team="t", payload={}, requester="bob", state="PENDING_APPROVAL",
        approval_policy={}, approvals=[], base_git_sha=None,
    )
    assert not is_stale(r, current_git_sha="whatever")
