"""Groups picker field — scoped Keycloak lookup (Task 3).

The BFF serves groups from Keycloak; the browser never hits the directory. A
request that would return the whole directory (no scope) is rejected. Keycloak is
mocked with httpx.MockTransport so we can assert the outgoing scoping.
"""

import httpx
import pytest

from app.services.fields import groups

pytestmark = pytest.mark.anyio


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://kc.example/admin"
    )


async def test_prefix_scope_calls_keycloak_scoped_and_maps_results():
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["url"] = str(req.url)
        return httpx.Response(
            200,
            json=[
                {"id": "1", "name": "payments-admins", "path": "/payments-admins"},
                {"id": "2", "name": "payments-ro", "path": "/payments-ro"},
            ],
        )

    async with _client(handler) as c:
        out = await groups.list_groups("prefix:payments", requester_groups=[], client=c)

    # Scoped: the search term is passed to Keycloak (not a whole-directory list).
    assert "search=payments" in seen["url"]
    assert {g["name"] for g in out} == {"payments-admins", "payments-ro"}


async def test_mine_scope_returns_requester_groups_without_directory_call():
    def handler(req: httpx.Request) -> httpx.Response:  # must not be called
        raise AssertionError("mine scope must not query the directory")

    async with _client(handler) as c:
        out = await groups.list_groups(
            "mine", requester_groups=["payments", "search"], client=c
        )
    assert {g["name"] for g in out} == {"payments", "search"}


@pytest.mark.parametrize("scope", ["", None, "all", "*", "prefix:"])
async def test_unscoped_request_is_rejected(scope):
    def handler(req: httpx.Request) -> httpx.Response:  # must not be called
        raise AssertionError("whole-directory query must be rejected before HTTP")

    async with _client(handler) as c:
        with pytest.raises(groups.ScopeRequired):
            await groups.list_groups(scope, requester_groups=[], client=c)


async def test_groups_endpoint_scopes_and_rejects_whole_directory(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    from app.api import fields as fields_api
    from app.auth.deps import current_principal
    from app.auth.principal import Principal
    from app.main import app

    principal = Principal(
        sub="u", username="u", groups=["payments"], roles=set(), teams={"payments"}
    )
    app.dependency_overrides[current_principal] = lambda: principal

    # Swap the Keycloak admin client for a mock transport (async, like the real one).
    async def fake_factory() -> httpx.AsyncClient:
        return _client(
            lambda req: httpx.Response(
                200, json=[{"id": "1", "name": "payments-admins", "path": "/p"}]
            )
        )

    monkeypatch.setattr(fields_api, "_kc_client_factory", fake_factory)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # No scope -> 400, never reaches the directory.
        r = await c.get("/api/fields/groups")
        assert r.status_code == 400
        # mine -> the requester's own groups, no Keycloak call.
        r = await c.get("/api/fields/groups?scope=mine")
        assert r.status_code == 200
        assert {g["name"] for g in r.json()["items"]} == {"payments"}
        # prefix -> scoped Keycloak results.
        r = await c.get("/api/fields/groups?scope=prefix:payments")
        assert r.status_code == 200
        assert r.json()["items"][0]["name"] == "payments-admins"
    app.dependency_overrides.clear()
