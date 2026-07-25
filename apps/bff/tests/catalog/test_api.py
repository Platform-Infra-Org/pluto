"""Catalog API tests. Runs the ASGI app in the test's own event loop (httpx
ASGITransport) so the overridden DB session shares that loop."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.catalog.git_sync import sync_repo
from app.db import get_session
from app.main import app

REQUESTER = Principal(sub="u1", username="req", groups=[], roles={"requester"}, teams={"payments"})
ADMIN = Principal(sub="u2", username="adm", groups=[], roles={"platform-admin"}, teams=set())


@pytest.fixture
async def client(session, git_fixture, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "git_repo_url", git_fixture["src"])
    monkeypatch.setattr(settings, "git_branch", git_fixture["branch"])
    monkeypatch.setattr(settings, "git_cache_dir", str(tmp_path / "cache"))
    await sync_repo(session)

    holder = {"principal": REQUESTER}

    async def _get_session():
        yield session

    app.dependency_overrides[get_session] = _get_session
    app.dependency_overrides[current_principal] = lambda: holder["principal"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, holder
    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_requester_sees_only_their_team_admin_sees_all(client):
    c, holder = client

    holder["principal"] = REQUESTER
    rows = (await c.get("/api/resources")).json()["items"]
    assert {r["name"] for r in rows} == {"orders-db"}  # payments only, SQL-enforced

    holder["principal"] = ADMIN
    rows = (await c.get("/api/resources")).json()["items"]
    assert {r["name"] for r in rows} == {"orders-db", "sessions", "broken"}


@pytest.mark.anyio
async def test_filter_by_type_and_q(client):
    c, holder = client
    holder["principal"] = ADMIN
    rows = (await c.get("/api/resources?type=cache")).json()["items"]
    assert {r["name"] for r in rows} == {"sessions"}
    rows = (await c.get("/api/resources?q=orders")).json()["items"]
    assert {r["name"] for r in rows} == {"orders-db"}


@pytest.mark.anyio
async def test_detail_parsed_and_raw(client):
    c, holder = client
    holder["principal"] = ADMIN
    listed = (await c.get("/api/resources")).json()["items"]
    rid = next(r["id"] for r in listed if r["name"] == "orders-db")

    detail = (await c.get(f"/api/resources/{rid}")).json()
    assert detail["owner_team"] == "payments"
    assert detail["payload"]["spec"]["engine"] == "pg"

    raw = (await c.get(f"/api/resources/{rid}/raw")).text
    assert "engine" in raw

    history = (await c.get(f"/api/resources/{rid}/history")).json()
    assert len(history) >= 1
    assert history[0]["sha"] == git_sha_of(listed, rid)


def git_sha_of(listed, rid):
    return next(r["git_sha"] for r in listed if r["id"] == rid)


@pytest.mark.anyio
async def test_graph_endpoint_returns_target_node(client):
    c, holder = client
    holder["principal"] = ADMIN
    listed = (await c.get("/api/resources")).json()["items"]
    rid = next(r["id"] for r in listed if r["name"] == "orders-db")
    g = (await c.get(f"/api/resources/{rid}/graph")).json()
    assert rid in {n["id"] for n in g["nodes"]}


@pytest.mark.anyio
async def test_graph_endpoint_rbac_404(client):
    c, holder = client
    holder["principal"] = ADMIN
    listed = (await c.get("/api/resources")).json()["items"]
    rid = next(r["id"] for r in listed if r["name"] == "sessions")  # search-owned
    holder["principal"] = REQUESTER
    assert (await c.get(f"/api/resources/{rid}/graph")).status_code == 404


@pytest.mark.anyio
async def test_requester_cannot_read_other_teams_detail(client):
    c, holder = client
    holder["principal"] = ADMIN
    listed = (await c.get("/api/resources")).json()["items"]
    rid = next(r["id"] for r in listed if r["name"] == "sessions")  # owned by search

    holder["principal"] = REQUESTER
    assert (await c.get(f"/api/resources/{rid}")).status_code == 404
