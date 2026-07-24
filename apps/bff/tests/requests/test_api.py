"""Task 5: request API — submit, queue, approve/reject, bypass, staleness.

Runs the ASGI app in the test's own event loop (httpx ASGITransport) so the
overridden DB session shares that loop.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.db import get_session
from app.main import app
from app.models.resource import ResourceIndex

pytestmark = pytest.mark.anyio

REQUESTER = Principal(sub="bob", username="bob", groups=[], roles={"requester"}, teams={"payments"})
APPROVER = Principal(sub="alice", username="alice", groups=[], roles={"requester"}, teams={"payments"})
OUTSIDER = Principal(sub="mallory", username="mallory", groups=[], roles={"requester"}, teams={"search"})
ADMIN = Principal(sub="adm", username="adm", groups=[], roles={"platform-admin"}, teams=set())
AUDITOR = Principal(sub="aud", username="aud", groups=[], roles={"auditor"}, teams=set())


async def _seed(session, *, policy=None, sha="sha1"):
    meta = {"ownerTeam": "payments"}
    if policy:
        meta["approvalPolicy"] = policy
    row = ResourceIndex(
        type="database", name="orders-db", owner_team="payments",
        git_path="resources/database/orders-db.json", git_sha=sha,
        payload={"metadata": meta, "spec": {"engine": "pg"}}, status="active",
    )
    session.add(row)
    await session.commit()
    return row.id


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


async def _submit(c, rid, action="UPDATE"):
    return await c.post("/api/requests", json={
        "action": action, "resource_type": "database", "resource_id": rid,
        "payload": {"metadata": {"ownerTeam": "payments"}, "spec": {"engine": "pg16"}},
    })


async def test_submit_queue_approve_reaches_approved(client):
    c, holder, session = client
    rid = await _seed(session)

    holder["principal"] = REQUESTER
    r = await _submit(c, rid)
    assert r.status_code == 201
    req_id = r.json()["id"]
    assert r.json()["state"] == "PENDING_APPROVAL"

    # Appears in the owner-team approver's queue, not the requester's own queue view.
    holder["principal"] = APPROVER
    queue = (await c.get("/api/requests?queue=1")).json()["items"]
    assert req_id in {x["id"] for x in queue}

    # Owner-team member approves -> APPROVED (SINGLE default).
    approved = await c.post(f"/api/requests/{req_id}/approve", json={"note": "lgtm"})
    assert approved.status_code == 200
    assert approved.json()["state"] == "APPROVED"


async def test_requester_cannot_self_approve(client):
    c, holder, session = client
    rid = await _seed(session)
    holder["principal"] = REQUESTER
    req_id = (await _submit(c, rid)).json()["id"]
    resp = await c.post(f"/api/requests/{req_id}/approve", json={})
    assert resp.status_code == 403


async def test_outsider_cannot_approve(client):
    c, holder, session = client
    rid = await _seed(session)
    holder["principal"] = REQUESTER
    req_id = (await _submit(c, rid)).json()["id"]
    holder["principal"] = OUTSIDER
    assert (await c.post(f"/api/requests/{req_id}/approve", json={})).status_code == 403


async def test_mine_lists_own_requests(client):
    c, holder, session = client
    rid = await _seed(session)
    holder["principal"] = REQUESTER
    await _submit(c, rid)
    mine = (await c.get("/api/requests?mine=1")).json()["items"]
    assert len(mine) == 1 and mine[0]["requester"] == "bob"
    # Approver sees none of their own.
    holder["principal"] = APPROVER
    assert (await c.get("/api/requests?mine=1")).json()["items"] == []


async def test_rbac_requester_auto_approves(client):
    c, holder, session = client
    rid = await _seed(session, policy={"mode": "RBAC"})
    holder["principal"] = REQUESTER  # in payments -> RBAC-permitted
    r = await _submit(c, rid)
    assert r.status_code == 201
    assert r.json()["state"] == "APPROVED"  # self-service, no wait


async def test_admin_bypass_logs_reason(client):
    c, holder, session = client
    rid = await _seed(session, policy={"mode": "N_OF_M", "n": 2})
    holder["principal"] = REQUESTER
    req_id = (await _submit(c, rid)).json()["id"]

    holder["principal"] = ADMIN
    no_reason = await c.post(f"/api/requests/{req_id}/bypass", json={})
    assert no_reason.status_code == 400  # reason required
    ok = await c.post(f"/api/requests/{req_id}/bypass", json={"reason": "prod incident"})
    assert ok.status_code == 200 and ok.json()["state"] == "APPROVED"

    detail = (await c.get(f"/api/requests/{req_id}")).json()
    bypass_events = [e for e in detail["events"] if "admin_bypass" in e["flags"]]
    assert bypass_events and bypass_events[0]["note"] == "prod incident"


async def test_stale_approval_blocked_until_confirmed(client):
    c, holder, session = client
    rid = await _seed(session, sha="sha1")
    holder["principal"] = REQUESTER
    req_id = (await _submit(c, rid)).json()["id"]

    # Resource moves in Git after submit.
    await session.execute(update(ResourceIndex).where(ResourceIndex.id == rid).values(git_sha="sha2"))
    await session.commit()

    holder["principal"] = APPROVER
    stale = await c.post(f"/api/requests/{req_id}/approve", json={})
    assert stale.status_code == 409  # stale — needs re-confirm
    ok = await c.post(f"/api/requests/{req_id}/approve", json={"confirm_stale": True})
    assert ok.status_code == 200 and ok.json()["state"] == "APPROVED"


# Fix 2: cross-team disclosure — read endpoints are scoped.
async def test_default_list_scoped_to_visible_set(client):
    c, holder, session = client
    rid = await _seed(session)
    holder["principal"] = REQUESTER
    req_id = (await _submit(c, rid)).json()["id"]

    # Outsider (different team, not requester) sees nothing in the default list.
    holder["principal"] = OUTSIDER
    assert (await c.get("/api/requests")).json()["items"] == []
    # Owner-team member does see it.
    holder["principal"] = APPROVER
    assert req_id in {x["id"] for x in (await c.get("/api/requests")).json()["items"]}
    # Auditor sees all.
    holder["principal"] = AUDITOR
    assert req_id in {x["id"] for x in (await c.get("/api/requests")).json()["items"]}


async def test_detail_404_for_outsider(client):
    c, holder, session = client
    rid = await _seed(session)
    holder["principal"] = REQUESTER
    req_id = (await _submit(c, rid)).json()["id"]

    holder["principal"] = OUTSIDER
    assert (await c.get(f"/api/requests/{req_id}")).status_code == 404
    holder["principal"] = APPROVER  # owner team
    assert (await c.get(f"/api/requests/{req_id}")).status_code == 200
    holder["principal"] = AUDITOR
    assert (await c.get(f"/api/requests/{req_id}")).status_code == 200
    holder["principal"] = ADMIN
    assert (await c.get(f"/api/requests/{req_id}")).status_code == 200


# Fix 1: malformed N_OF_M override does not approve with a single approver.
async def test_malformed_n_of_m_override_falls_back_to_single(client):
    c, holder, session = client
    # Override lacks `n` -> rejected, falls back to SINGLE default (still needs 1 approver).
    rid = await _seed(session, policy={"mode": "N_OF_M"})
    holder["principal"] = REQUESTER
    r = await _submit(c, rid)
    assert r.status_code == 201
    assert r.json()["approval_policy"]["mode"] == "SINGLE"


# Fix 4: approve/reject on a non-PENDING_APPROVAL request -> 409.
async def test_approve_already_approved_is_409(client):
    c, holder, session = client
    rid = await _seed(session)
    holder["principal"] = REQUESTER
    req_id = (await _submit(c, rid)).json()["id"]
    holder["principal"] = APPROVER
    assert (await c.post(f"/api/requests/{req_id}/approve", json={})).status_code == 200
    # Second approve on an APPROVED request must not append/return 200.
    again = await c.post(f"/api/requests/{req_id}/approve", json={})
    assert again.status_code == 409
    assert (await c.post(f"/api/requests/{req_id}/reject", json={})).status_code == 409


# Fix 5: target resource vanished from the index -> not approvable as fresh.
async def test_missing_resource_blocks_approval(client):
    c, holder, session = client
    rid = await _seed(session)
    holder["principal"] = REQUESTER
    req_id = (await _submit(c, rid)).json()["id"]

    await session.execute(ResourceIndex.__table__.delete().where(ResourceIndex.id == rid))
    await session.commit()

    holder["principal"] = APPROVER
    gone = await c.post(f"/api/requests/{req_id}/approve", json={})
    assert gone.status_code == 409
    # Even confirm_stale must not force a fresh approval of a vanished resource.
    forced = await c.post(f"/api/requests/{req_id}/approve", json={"confirm_stale": True})
    assert forced.status_code == 409
