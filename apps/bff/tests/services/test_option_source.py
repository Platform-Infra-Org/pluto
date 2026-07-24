"""Dynamic-choice option-source poller + cache (Task 5).

The poller fetches each source on its interval (clamped >= 60s), maps the
response to {label, value}, caches it in Postgres, dedups by source, and keeps
the last-good cache on failure. Upstream is mocked with httpx.MockTransport.
"""

import httpx
import pytest

from app.services.fields import option_source as os_mod
from app.services.fields.option_source import (
    MIN_REFRESH_SECONDS,
    clamp_interval,
    get_or_create,
    map_options,
    refresh,
)

pytestmark = pytest.mark.anyio


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://api.example")


def test_interval_clamped_to_60s_floor():
    assert clamp_interval(5) == MIN_REFRESH_SECONDS
    assert clamp_interval(30) == 60
    assert clamp_interval(300) == 300


def test_map_options_reads_dotted_paths():
    body = {"data": [{"k": "a", "label": "Alpha"}, {"k": "b", "label": "Beta"}]}
    out = map_options(body, {"items_path": "data", "label_path": "label", "value_path": "k"})
    assert out == [{"label": "Alpha", "value": "a"}, {"label": "Beta", "value": "b"}]


async def test_get_or_create_dedups_by_source(session):
    a = await get_or_create(session, "https://api.example/opts", "GET", refresh_interval=10)
    b = await get_or_create(session, "https://api.example/opts", "GET")
    assert a.id == b.id
    # interval was clamped on create
    assert a.refresh_interval == MIN_REFRESH_SECONDS


async def test_refresh_fetches_maps_and_caches(session):
    src = await get_or_create(
        session,
        "https://api.example/opts",
        mapping={"label_path": "name", "value_path": "id"},
    )

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[{"id": "r1", "name": "Region 1"}])

    async with _client(handler) as c:
        await refresh(session, src, c)

    assert src.last_status == "ok"
    assert src.last_synced_at is not None
    assert src.cached_options == [{"label": "Region 1", "value": "r1"}]


async def test_failed_refresh_keeps_last_good_and_marks_stale(session):
    src = await get_or_create(
        session, "https://api.example/opts", mapping={"label_path": "name", "value_path": "id"}
    )
    src.cached_options = [{"label": "Region 1", "value": "r1"}]  # last-good
    src.last_status = "ok"
    await session.commit()

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    async with _client(handler) as c:
        await refresh(session, src, c)

    assert src.last_status == "stale"
    assert src.cached_options == [{"label": "Region 1", "value": "r1"}]  # unchanged


async def test_auth_uses_secret_reference_from_env_never_inline(session, monkeypatch):
    monkeypatch.setenv("OPTS_TOKEN", "s3cr3t")
    src = await get_or_create(
        session, "https://api.example/opts", auth_secret_ref="OPTS_TOKEN"
    )
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["auth"] = req.headers.get("authorization")
        return httpx.Response(200, json=[])

    async with _client(handler) as c:
        await refresh(session, src, c)
    # Credential resolved from env by reference, not stored inline on the source.
    assert seen["auth"] == "Bearer s3cr3t"
    assert src.auth_secret_ref == "OPTS_TOKEN"


async def test_options_endpoint_serves_from_cache(session):
    src = await get_or_create(session, "https://api.example/opts")
    src.cached_options = [{"label": "A", "value": "a"}]
    src.last_status = "ok"
    await session.commit()

    from httpx import ASGITransport, AsyncClient

    from app.auth.deps import current_principal
    from app.auth.principal import Principal
    from app.db import get_session
    from app.main import app

    async def _get_session():
        yield session

    app.dependency_overrides[get_session] = _get_session
    app.dependency_overrides[current_principal] = lambda: Principal(
        sub="u", username="u", groups=[], roles=set(), teams=set()
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.get(f"/api/fields/options/{src.id}")
    app.dependency_overrides.clear()
    assert r.status_code == 200
    assert r.json()["items"] == [{"label": "A", "value": "a"}]
    assert r.json()["status"] == "ok"


def test_module_exposes_min_floor():
    assert os_mod.MIN_REFRESH_SECONDS == 60
