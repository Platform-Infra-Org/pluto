"""Registry + admin-gated blocks API (CB01 Task 4)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.db import get_session
from app.main import app
from app.services.definition import ServiceDefinition

pytestmark = pytest.mark.anyio

ADMIN = Principal(sub="adm", username="adm", groups=[], roles={"platform-admin"}, teams=set())
COMPOSER = Principal(sub="own", username="own", groups=[], roles={"service-owner"}, teams={"payments"})

VALID = """
kind: FunctionBlock
metadata:
  name: set-value
  category: builtin
  icon: function
template:
  ref: fn-set-value
inputs:
  - name: expr
    type: string
    required: true
outputs:
  - name: value
    type: json
"""

INVALID = """
kind: FunctionBlock
metadata:
  name: broken
template:
  ref: fn-broken
inputs:
  - name: x
    type: widget
outputs: []
"""


@pytest.fixture
async def client(session):
    holder = {"principal": ADMIN}

    async def _get_session():
        yield session

    app.dependency_overrides[get_session] = _get_session
    app.dependency_overrides[current_principal] = lambda: holder["principal"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, holder
    app.dependency_overrides.clear()


async def test_non_admin_post_forbidden(client):
    c, holder = client
    holder["principal"] = COMPOSER
    r = await c.post("/api/blocks", json={"manifest": VALID})
    assert r.status_code == 403


async def test_admin_post_stores_and_lists(client):
    c, holder = client
    holder["principal"] = ADMIN
    r = await c.post("/api/blocks", json={"manifest": VALID})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "set-value" and body["version"] == 1
    assert body["manifest"]["template_ref"] == "fn-set-value"
    assert body["manifest"]["inputs"][0]["type"] == "string"

    # Any authed composer can read it back.
    holder["principal"] = COMPOSER
    listed = (await c.get("/api/blocks")).json()["items"]
    names = {b["name"]: b for b in listed}
    assert "set-value" in names
    assert names["set-value"]["kind"] == "function"

    got = (await c.get("/api/blocks/set-value")).json()
    assert got["manifest"]["outputs"][0]["name"] == "value"


async def test_invalid_manifest_422(client):
    c, holder = client
    holder["principal"] = ADMIN
    r = await c.post("/api/blocks", json={"manifest": INVALID})
    assert r.status_code == 422


async def test_active_service_blocks_listed(client, session):
    c, holder = client
    session.add(
        ServiceDefinition(
            name="network",
            category="infra",
            owner_team="platform",
            form_schema={"type": "object", "properties": {"region": {"type": "string"}}, "required": ["region"]},
            workflow_binding={"create": {"template_ref": "network"}},
            status="ACTIVE",
            version=1,
        )
    )
    # A DRAFT service must NOT appear (only ACTIVE dependencies are wireable).
    session.add(
        ServiceDefinition(name="draftsvc", category="infra", owner_team="platform", status="DRAFT", version=1)
    )
    await session.commit()

    holder["principal"] = COMPOSER
    listed = (await c.get("/api/blocks")).json()["items"]
    by = {b["name"]: b for b in listed}
    assert by["network"]["kind"] == "service"
    assert by["network"]["manifest"]["category"] == "service"
    assert by["network"]["manifest"]["inputs"][0]["name"] == "region"
    assert "draftsvc" not in by


async def test_upsert_bumps_version(client):
    c, holder = client
    holder["principal"] = ADMIN
    assert (await c.post("/api/blocks", json={"manifest": VALID})).json()["version"] == 1
    # PUT the same block again -> new version row.
    r = await c.put("/api/blocks", json={"manifest": VALID})
    assert r.status_code == 201
    assert r.json()["version"] == 2
    # GET lists only the latest version.
    holder["principal"] = COMPOSER
    listed = [b for b in (await c.get("/api/blocks")).json()["items"] if b["name"] == "set-value"]
    assert len(listed) == 1 and listed[0]["version"] == 2


async def test_admin_post_manifest_json_form(client):
    """The 'new block' form posts a structured manifest_json (not raw YAML)."""
    c, holder = client
    holder["principal"] = ADMIN
    mj = {
        "name": "slack-notify",
        "category": "custom",
        "icon": "bell",
        "template_ref": "fn-slack-notify",
        "inputs": [
            {"name": "channel", "type": "string", "required": True},
            {"name": "method", "type": "enum[GET,POST]", "required": False},
        ],
        "outputs": [{"name": "ok", "type": "boolean"}],
    }
    r = await c.post("/api/blocks", json={"manifest_json": mj})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "slack-notify"
    assert body["manifest"]["template_ref"] == "fn-slack-notify"
    types = {f["name"]: f["type"] for f in body["manifest"]["inputs"]}
    assert types["channel"] == "string" and types["method"] == "enum[GET,POST]"


async def test_manifest_json_missing_required_422(client):
    c, holder = client
    holder["principal"] = ADMIN
    # no template_ref -> rejected, not a 500
    r = await c.post("/api/blocks", json={"manifest_json": {"name": "x", "inputs": [], "outputs": []}})
    assert r.status_code == 422, r.text
