"""Task 3: REST inbox history + mark-read, and stream auth."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.db import get_session
from app.main import app
from app.notifications import service

pytestmark = pytest.mark.anyio

ALICE = Principal(sub="alice", username="alice", groups=[], roles=set(), teams={"payments"})
AUDIT = Principal(sub="audrey", username="audrey", groups=[], roles={"auditor"}, teams={"payments"})


@pytest.fixture
async def client(session):
    async def _get_session():
        yield session

    app.dependency_overrides[get_session] = _get_session
    app.dependency_overrides[current_principal] = lambda: ALICE
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, session
    app.dependency_overrides.clear()


async def test_list_includes_own_and_team_and_unread_count(client):
    c, session = client
    await service.notify(session, "alice", "REQUEST_APPROVED", 1, "own", "")
    await service.notify(session, "payments", "APPROVAL_NEEDED", 2, "team", "")

    r = await c.get("/api/notifications")
    body = r.json()
    assert r.status_code == 200
    assert {i["request_id"] for i in body["items"]} == {1, 2}
    assert body["unread"] == 2


async def test_mark_all_read_clears_unread(client):
    c, session = client
    await service.notify(session, "alice", "REQUEST_APPROVED", 1, "a", "")
    await service.notify(session, "payments", "APPROVAL_NEEDED", 2, "b", "")

    r = await c.post("/api/notifications/read", json={})  # ids omitted => all
    assert r.json() == {"updated": 2, "unread": 0}


async def test_mark_read_rejects_auditor(client):
    c, session = client
    await service.notify(session, "alice", "REQUEST_APPROVED", 1, "own", "")

    app.dependency_overrides[current_principal] = lambda: AUDIT
    r = await c.post("/api/notifications/read", json={})
    assert r.status_code == 403

    app.dependency_overrides[current_principal] = lambda: ALICE
    r = await c.post("/api/notifications/read", json={})
    assert r.status_code == 200


async def test_stream_requires_auth():
    # No principal override: the real auth dependency must reject.
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.get("/api/notifications/stream")
    assert r.status_code == 401
