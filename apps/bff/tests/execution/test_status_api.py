"""Task 5: GET /api/requests/{id}/status — normalized node tree + phase +
failed step, with the same visibility scoping as the request read endpoint."""

import json
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.workflow_status import get_argo_client
from app.argo.status import normalize_status
from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.db import get_session
from app.main import app

from .conftest import make_approved

pytestmark = pytest.mark.anyio

FAILED_DAG = json.loads(
    (Path(__file__).parents[1] / "argo" / "fixtures" / "failed_dag.json").read_text()
)

REQUESTER = Principal(sub="bob", username="bob", groups=[], roles={"requester"}, teams={"payments"})
OUTSIDER = Principal(sub="mallory", username="mallory", groups=[], roles={"requester"}, teams={"search"})


class _StubArgo:
    def __init__(self, ws):
        self.ws = ws

    async def get(self, ref):
        return self.ws


@pytest.fixture
async def client(session):
    holder = {"principal": REQUESTER, "argo": _StubArgo(normalize_status(FAILED_DAG))}

    async def _get_session():
        yield session

    app.dependency_overrides[get_session] = _get_session
    app.dependency_overrides[current_principal] = lambda: holder["principal"]
    app.dependency_overrides[get_argo_client] = lambda: holder["argo"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, holder, session
    app.dependency_overrides.clear()


async def _executing(session):
    req = await make_approved(session)
    req.state = "EXECUTING"
    req.workflow_ref = "platform/deploy-bad-xyz98"
    await session.commit()
    return req


async def test_status_returns_node_tree_with_failed_step_highlighted(client):
    c, holder, session = client
    req = await _executing(session)

    r = await c.get(f"/api/requests/{req.id}/status")
    assert r.status_code == 200
    body = r.json()
    assert body["phase"] == "Failed"

    nodes = {n["display_name"]: n for n in body["nodes"]}
    assert "deploy-db" in nodes
    # exactly the leaf failure is flagged, not the parent DAG that failed because of it
    assert nodes["deploy-db"]["failed"] is True
    assert nodes["deploy-bad-xyz98"]["failed"] is False
    assert body["failed_step"]["node"] == "deploy-db"
    assert "could not connect to database" in body["failed_step"]["message"]


async def test_status_before_submit_uses_persisted_state(client):
    c, holder, session = client
    req = await make_approved(session)  # APPROVED, no workflow_ref yet

    r = await c.get(f"/api/requests/{req.id}/status")
    assert r.status_code == 200
    body = r.json()
    assert body["phase"] == "APPROVED"
    assert body["nodes"] == []
    assert body["failed_step"] is None


async def test_status_hidden_from_outsider_is_404(client):
    c, holder, session = client
    req = await _executing(session)

    holder["principal"] = OUTSIDER
    r = await c.get(f"/api/requests/{req.id}/status")
    assert r.status_code == 404
