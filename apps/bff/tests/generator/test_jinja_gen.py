"""CB02 Task 3 — emit build-json.j2 (golden §6) + live jinja2 resolution walk."""

from __future__ import annotations

import json
from pathlib import Path

from jinja2 import Environment

from app.generator.jinja_gen import emit_jinja
from tests.generator import fixtures

GOLDEN = Path(__file__).parent / "golden" / "app-database.build-json.j2"
REQUEST = {"app_name": "app-42", "size": "small", "region": "eu-west-1"}
RESOLVED = {
    "mapping.children.network.outputs.subnet_id": "subnet-abc",
    "mapping.internals.lookup_account.outputs.account_id": "acc-9",
}


def test_emit_jinja_matches_golden():
    assert emit_jinja(fixtures.app_database_create()) == GOLDEN.read_text()


def test_render_zero_has_placeholders():
    tpl = Environment().from_string(emit_jinja(fixtures.app_database_create()))
    doc = json.loads(tpl.render(request=REQUEST, resolved={}))
    body = doc["payload"]["body"]
    # request fields are concrete already; dependency/internal outputs are placeholders
    assert body["region"] == "eu-west-1"
    assert body["subnet_id"] == "<<mapping.children.network.outputs.subnet_id>>"
    assert body["account_id"] == "<<mapping.internals.lookup_account.outputs.account_id>>"
    # mapping.*.inputs and the internal request are concrete at render #0
    assert doc["mapping"]["children"]["network"]["inputs"]["region"] == "eu-west-1"
    url = doc["mapping"]["internals"]["lookup_account"]["request"]["url"]
    assert url == "https://accounts.api/accounts?name=app-42"


def test_render_with_resolved_map_is_fully_concrete():
    tpl = Environment().from_string(emit_jinja(fixtures.app_database_create()))
    rendered = tpl.render(request=REQUEST, resolved=RESOLVED)
    assert "<<" not in rendered  # every placeholder resolved
    body = json.loads(rendered)["payload"]["body"]
    assert body["subnet_id"] == "subnet-abc"
    assert body["account_id"] == "acc-9"
