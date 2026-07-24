"""CB04 Task 3 — opt-in verbs, full editability, version bump (pin-until-migrated).

An owner reopens a definition to edit a verb's graph or add/remove a verb. Every
edit creates a NEW version row (regenerated) and re-enters SERVICE_ONBOARDING; the
old version row is untouched so resources pinned to it keep resolving.
"""

import pytest
from httpx import ASGITransport, AsyncClient
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
from app.models.resource import ResourceIndex
from app.services import definition as service_def

pytestmark = pytest.mark.anyio

OWNER = Principal(sub="own", username="own", groups=[], roles={"service-owner"}, teams={"payments"})
ADMIN = Principal(sub="adm", username="adm", groups=[], roles={"platform-admin"}, teams=set())


@pytest.fixture
async def session():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text(
            "TRUNCATE function_block, service_definition, request_event, request, "
            "resource_index RESTART IDENTITY"
        ))
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        await seed_builtins(s)
        yield s
    await engine.dispose()


@pytest.fixture
async def client(session):
    holder = {"principal": OWNER}

    async def _get_session():
        yield session

    app.dependency_overrides[get_session] = _get_session
    app.dependency_overrides[current_principal] = lambda: holder["principal"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, holder, session
    app.dependency_overrides.clear()


def _main(method, url):
    return {"id": "main", "block": "api-call", "kind": "main",
            "input_bindings": {"method": method, "url": url,
                               "body": {"name": {"kind": "request", "field": "app_name"}}}}


def _create_graph():
    return {"request_fields": {"app_name": "string"}, "nodes": [_main("POST", "https://db.api/x")]}


def _delete_graph():
    return {"request_fields": {"app_name": "string"}, "nodes": [_main("DELETE", "https://db.api/x/{app_name}")]}


async def test_add_and_remove_verb_bumps_version_and_reonboards(client):
    c, holder, session = client
    holder["principal"] = OWNER

    # Create-only service, save its graph, submit.
    d = (await c.post("/api/services/definitions", json={
        "name": "app-database", "owner_team": "payments"})).json()
    edit = await c.post(f"/api/services/definitions/{d['id']}/edit",
                        json={"graphs": {"name": "app-database", "create": _create_graph()}})
    assert edit.status_code == 200, edit.text
    v1 = edit.json()
    assert v1["version"] == 1 and v1["request_id"]
    assert "- name: create" in v1["definition"]["generated"]["workflow_template_yaml"]

    # Admin approves v1 -> ACTIVE; pin a resource to v1.
    holder["principal"] = ADMIN
    await c.post(f"/api/services/onboarding/{v1['request_id']}/approve", json={"note": "ok"})
    session.add(ResourceIndex(type="app-database", name="db1", owner_team="payments",
                              git_path="x", git_sha="s", payload={"spec": {}}, definition_version=1))
    await session.commit()

    # Add a delete verb -> new version, regenerated with BOTH templates, new pending request.
    holder["principal"] = OWNER
    add = await c.post(f"/api/services/definitions/{v1['definition']['id']}/edit", json={
        "graphs": {"name": "app-database", "create": _create_graph(), "delete": _delete_graph()}})
    assert add.status_code == 200, add.text
    v2 = add.json()
    assert v2["version"] == 2
    yaml2 = v2["definition"]["generated"]["workflow_template_yaml"]
    assert "- name: create" in yaml2 and "- name: delete" in yaml2
    assert v2["request_id"] and v2["definition"]["status"] == "PENDING_ONBOARDING"

    # Pin-until-migrated: the resource created under v1 still resolves the ACTIVE v1 row.
    v1_row = await service_def.resolve(session, "app-database", version=1)
    assert v1_row.status == "ACTIVE"
    assert "create" in v1_row.graphs and "delete" not in v1_row.graphs

    # Remove the delete verb again -> v3, create-only, regenerated.
    remove = await c.post(f"/api/services/definitions/{v2['definition']['id']}/edit", json={
        "graphs": {"name": "app-database", "create": _create_graph()}})
    v3 = remove.json()
    assert v3["version"] == 3
    yaml3 = v3["definition"]["generated"]["workflow_template_yaml"]
    assert "- name: delete" not in yaml3


async def test_invalid_graph_edit_rejected_no_version_created(client):
    c, holder, session = client
    holder["principal"] = OWNER
    d = (await c.post("/api/services/definitions", json={
        "name": "svc", "owner_team": "payments"})).json()
    two_mains = {"request_fields": {"app_name": "string"},
                 "nodes": [_main("POST", "u"), {**_main("POST", "u"), "id": "m2"}]}
    r = await c.post(f"/api/services/definitions/{d['id']}/edit",
                     json={"graphs": {"name": "svc", "create": two_mains}})
    assert r.status_code == 422, r.text
    # No new version row was created (still only v1).
    assert await service_def.next_version(session, "svc") == 2


async def test_zero_verbs_rejected(client):
    c, holder, session = client
    holder["principal"] = OWNER
    d = (await c.post("/api/services/definitions", json={
        "name": "svc", "owner_team": "payments"})).json()
    r = await c.post(f"/api/services/definitions/{d['id']}/edit",
                     json={"graphs": {"name": "svc"}})
    assert r.status_code == 422, r.text
    # No new version row was created (still only v1).
    assert await service_def.next_version(session, "svc") == 2


async def test_edit_requires_owning_team(client):
    c, holder, session = client
    holder["principal"] = OWNER
    d = (await c.post("/api/services/definitions", json={
        "name": "svc", "owner_team": "payments"})).json()
    holder["principal"] = Principal(sub="x", username="x", groups=[], roles={"service-owner"}, teams={"other"})
    r = await c.post(f"/api/services/definitions/{d['id']}/edit",
                     json={"graphs": {"name": "svc", "create": _create_graph()}})
    assert r.status_code == 403


async def test_non_generation_error_returns_clean_422(client):
    """A graph that passes validation but raises KeyError etc during generation returns 4xx, not 500."""
    c, holder, session = client
    holder["principal"] = OWNER
    d = (await c.post("/api/services/definitions", json={
        "name": "svc", "owner_team": "payments"})).json()
    # set-value node marked as main passes validation (expr bound) but raises KeyError
    # on emit — _payload reads input_bindings["method"], which set-value has no notion of.
    bad_graph = {
        "request_fields": {"val": "string"},
        "nodes": [{
            "id": "main", "block": "set-value", "kind": "main",
            "input_bindings": {"expr": "test"}
        }]
    }
    r = await c.post(f"/api/services/definitions/{d['id']}/edit",
                     json={"graphs": {"name": "svc", "create": bad_graph}})
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"
    # No new version row was created (still only v1).
    assert await service_def.next_version(session, "svc") == 2
