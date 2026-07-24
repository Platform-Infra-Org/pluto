"""fn-jinja-render — the §6 resolution engine (design §5/§6).

Tested against the REAL CB02-generated template (the generator's golden
`build-json.j2`) so the runtime engine round-trips with the printed output.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from fn.render import render, unresolved

# The actual CB02 generator golden output — round-trip contract.
GOLDEN = (
    Path(__file__).resolve().parents[2]
    / "apps/bff/tests/generator/golden/app-database.build-json.j2"
)
TEMPLATE = GOLDEN.read_text()

REQUEST = {"app_name": "app-42", "size": "small", "region": "eu-west-1"}

SUBNET = "mapping.children.network.outputs.subnet_id"
ACCOUNT = "mapping.internals.lookup_account.outputs.account_id"


def test_render0_emits_placeholders() -> None:
    doc = render(TEMPLATE, REQUEST, {})
    body = doc["payload"]["body"]
    # request.* fields are already concrete at render #0
    assert body["name"] == "app-42"
    assert body["region"] == "eu-west-1"
    # unresolved paths emit <<path>> tokens
    assert body["subnet_id"] == f"<<{SUBNET}>>"
    assert body["account_id"] == f"<<{ACCOUNT}>>"
    # mapping.*.inputs are concrete (only reference request.*)
    assert doc["mapping"]["children"]["network"]["inputs"]["region"] == "eu-west-1"


def test_unresolved_lists_remaining_paths() -> None:
    doc = render(TEMPLATE, REQUEST, {})
    paths = unresolved(doc)
    assert set(paths) == {SUBNET, ACCOUNT}


def test_full_resolved_yields_concrete_payload() -> None:
    resolved = {SUBNET: "subnet-abc", ACCOUNT: "acc-9"}
    doc = render(TEMPLATE, REQUEST, resolved)
    body = doc["payload"]["body"]
    assert body["subnet_id"] == "subnet-abc"
    assert body["account_id"] == "acc-9"
    # nothing left unresolved
    assert unresolved(doc) == []


def test_partial_resolution_reports_remainder() -> None:
    # a value that resolves in wave 1 but the other not yet — remainder reported,
    # never silently dropped.
    doc = render(TEMPLATE, REQUEST, {SUBNET: "subnet-abc"})
    assert doc["payload"]["body"]["subnet_id"] == "subnet-abc"
    assert doc["payload"]["body"]["account_id"] == f"<<{ACCOUNT}>>"
    assert unresolved(doc) == [ACCOUNT]


def test_resolved_value_can_be_json_object() -> None:
    # resolved values are tojson'd by ph() — objects/numbers round-trip, not just strings.
    doc = render(TEMPLATE, REQUEST, {SUBNET: {"id": "s-1"}, ACCOUNT: 7})
    assert doc["payload"]["body"]["subnet_id"] == {"id": "s-1"}
    assert doc["payload"]["body"]["account_id"] == 7


def test_render_returns_dict_not_string() -> None:
    doc = render(TEMPLATE, REQUEST, {})
    assert isinstance(doc, dict)
    # and it is valid JSON round-trip
    json.dumps(doc)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
