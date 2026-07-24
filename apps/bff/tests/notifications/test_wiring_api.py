"""Task 2 wiring: the E05 request API emits notifications on transitions."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.db import get_session
from app.main import app
from app.models.resource import ResourceIndex
from app.notifications import service

pytestmark = pytest.mark.anyio

REQUESTER = Principal(sub="bob", username="bob", groups=[], roles={"requester"}, teams={"payments"})
APPROVER = Principal(sub="alice", username="alice", groups=[], roles={"requester"}, teams={"payments"})


@pytest.fixture
async def client(session):
    holder = {"principal": REQUESTER}

    async def _get_session():
        yield session

    app.dependency_overrides[get_session] = _get_session
    app.dependency_overrides[current_principal] = lambda: holder["principal"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, holder, session
    app.dependency_overrides.clear()


async def _seed(session):
    row = ResourceIndex(
        type="database", name="orders-db", owner_team="payments",
        git_path="resources/database/orders-db.json", git_sha="sha1",
        payload={"metadata": {"ownerTeam": "payments"}, "spec": {"engine": "pg"}},
        status="active",
    )
    session.add(row)
    await session.commit()
    return row.id


async def test_submit_notifies_team_then_approve_notifies_requester(client):
    c, holder, session = client
    rid = await _seed(session)

    holder["principal"] = REQUESTER
    r = await c.post("/api/requests", json={
        "action": "UPDATE", "resource_type": "database", "resource_id": rid,
        "payload": {"metadata": {"ownerTeam": "payments"}, "spec": {"engine": "pg16"}},
    })
    req_id = r.json()["id"]

    team = await service.list_notifications(session, "payments")
    assert [n.type for n in team] == ["APPROVAL_NEEDED"]
    assert team[0].request_id == req_id

    holder["principal"] = APPROVER
    await c.post(f"/api/requests/{req_id}/approve", json={"confirm_stale": True})

    bob = await service.list_notifications(session, "bob")
    assert [n.type for n in bob] == ["REQUEST_APPROVED"]
