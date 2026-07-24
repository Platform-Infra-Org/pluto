"""CB03 Task 1 — POST /api/services/generate (live-preview wrapper over CB02).

Valid graphs -> artifacts. An invalid graph returns 200 with `errors` and no
partial YAML (so the editor can show the errors while the owner keeps typing).
Blocks are loaded from the registry (the seeded v1 built-ins).
"""

import json

import pytest
from httpx import ASGITransport, AsyncClient
from jinja2 import Environment
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.blocks.model import FunctionBlock  # noqa: F401 — register table
from app.blocks.seed import seed_builtins
from app.config import settings
from app.db import get_session
from app.main import app
from app.models.base import Base
from app.services.definition import ServiceDefinition  # noqa: F401 — register table

pytestmark = pytest.mark.anyio

OWNER = Principal(sub="own", username="own", groups=[], roles={"service-owner"}, teams={"p"})


@pytest.fixture
async def session():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("TRUNCATE function_block, service_definition RESTART IDENTITY"))
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        await seed_builtins(s)  # api-call, json-extractor, ...
        yield s
    await engine.dispose()


@pytest.fixture
async def client(session):
    async def _get_session():
        yield session

    app.dependency_overrides[get_session] = _get_session
    app.dependency_overrides[current_principal] = lambda: OWNER
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def _main_node(**over):
    node = {
        "id": "main",
        "block": "api-call",
        "kind": "main",
        "config": {
            "method": "POST",
            "url": "https://db.api/databases",
            "body": {"name": {"kind": "request", "field": "app_name"}},
        },
        "input_bindings": {},
        "outputs": [],
    }
    node.update(over)
    return node


def _graphs(nodes):
    return {
        "name": "svc",
        "create": {"request_fields": {"app_name": "string"}, "nodes": nodes},
    }


async def test_valid_graph_returns_artifacts(client):
    r = await client.post("/api/services/generate", json={"graphs": _graphs([_main_node()])})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["errors"] == []
    assert "payload" in body["build_json_j2"]
    assert "WorkflowTemplate" in body["workflow_template_yaml"]


async def test_invalid_graph_returns_errors_no_partial_yaml(client):
    # two `main` nodes -> validation error; generation blocked, no partial output.
    two = [_main_node(), _main_node(id="main2")]
    r = await client.post("/api/services/generate", json={"graphs": _graphs(two)})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["errors"], "expected validation errors"
    assert any("main" in e for e in body["errors"])
    assert body["workflow_template_yaml"] == ""
    assert body["build_json_j2"] == ""


async def test_main_body_binding_renders_request_value(client):
    # config.body binds `name -> request.app_name`; the rendered payload.body.name
    # must resolve to the request value (proves body is NOT empty and flows via config.body).
    r = await client.post("/api/services/generate", json={"graphs": _graphs([_main_node()])})
    assert r.status_code == 200, r.text
    tpl = Environment().from_string(r.json()["build_json_j2"])
    doc = json.loads(tpl.render(request={"app_name": "x"}, resolved={}))
    assert doc["payload"]["body"] == {"name": "x"}


# Malformed free-form graph JSON must never 500 — it comes back as errors[] (200)
# with empty artifacts, so the editor can show them while the owner keeps typing.
@pytest.mark.parametrize(
    "graphs",
    [
        pytest.param({"name": "s", "create": {"nodes": [{"block": "api-call", "kind": "main"}]}}, id="missing-id"),
        pytest.param({"name": "s", "create": {"nodes": [{"id": "m", "block": "api-call", "kind": "bogus"}]}}, id="bad-kind"),
        pytest.param({"name": "s", "create": {"nodes": "not-a-list"}}, id="nodes-not-list"),
        pytest.param({"name": "s", "create": "not-a-dict"}, id="verb-not-dict"),
        pytest.param({"name": "s", "create": {"request_fields": {"f": "notatype"}, "nodes": []}}, id="bad-request-field-type"),
    ],
)
async def test_malformed_graph_returns_errors_not_500(client, graphs):
    r = await client.post("/api/services/generate", json={"graphs": graphs})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["errors"], "expected parse errors, not a 500"
    assert body["build_json_j2"] == ""
    assert body["workflow_template_yaml"] == ""


async def test_requires_auth(client):
    app.dependency_overrides.pop(current_principal, None)
    r = await client.post("/api/services/generate", json={"graphs": _graphs([_main_node()])})
    assert r.status_code == 401
