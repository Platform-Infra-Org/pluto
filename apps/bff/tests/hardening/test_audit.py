"""Task 1: auditor role + audit views — read all teams, mutate nothing."""

import pytest

from app.models.request import Request, RequestEvent

from .conftest import ADMIN, AUDITOR, REQUESTER

pytestmark = pytest.mark.anyio


async def _seed_requests(session):
    r1 = Request(
        kind="RESOURCE_CHANGE", action="UPDATE", resource_type="database",
        owner_team="payments", payload={}, requester="bob", state="PENDING_APPROVAL",
        approval_policy={"mode": "SINGLE"}, approvals=[],
    )
    r1.events.append(RequestEvent(actor="bob", from_state=None, to_state="PENDING_APPROVAL", note="submit"))
    r2 = Request(
        kind="RESOURCE_CHANGE", action="CREATE", resource_type="topic",
        owner_team="search", payload={}, requester="carol", state="APPROVED",
        approval_policy={"mode": "SINGLE"}, approvals=[],
    )
    # an admin_bypass audit event lives on r2
    r2.events.append(RequestEvent(actor="carol", from_state=None, to_state="PENDING_APPROVAL", note="submit"))
    r2.events.append(
        RequestEvent(actor="adm", from_state="PENDING_APPROVAL", to_state="APPROVED",
                     note="urgent", flags=["admin_bypass"])
    )
    session.add_all([r1, r2])
    await session.commit()


async def test_auditor_reads_all_requests_across_teams(client):
    c, holder, session = client
    await _seed_requests(session)
    holder["principal"] = AUDITOR

    r = await c.get("/api/audit/requests")
    assert r.status_code == 200
    teams = {item["owner_team"] for item in r.json()["items"]}
    assert teams == {"payments", "search"}  # every team, not just the caller's


async def test_auditor_sees_admin_bypass_events(client):
    c, holder, session = client
    await _seed_requests(session)
    holder["principal"] = AUDITOR

    r = await c.get("/api/audit/events", params={"flag": "admin_bypass"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["flags"] == ["admin_bypass"]
    assert items[0]["actor"] == "adm"


async def test_admin_can_also_read_audit(client):
    c, holder, session = client
    await _seed_requests(session)
    holder["principal"] = ADMIN
    r = await c.get("/api/audit/requests")
    assert r.status_code == 200


async def test_non_auditor_non_admin_forbidden(client):
    c, holder, session = client
    holder["principal"] = REQUESTER
    assert (await c.get("/api/audit/requests")).status_code == 403
    assert (await c.get("/api/audit/events")).status_code == 403


async def test_auditor_cannot_write_anything(client):
    """Auditor is read-only: every mutating path returns 403."""
    c, holder, session = client
    await _seed_requests(session)
    holder["principal"] = AUDITOR

    # submit a new request
    r = await c.post("/api/requests", json={
        "action": "CREATE", "resource_type": "database", "payload": {"spec": {}},
    })
    assert r.status_code == 403

    # approve / reject / bypass an existing one
    assert (await c.post("/api/requests/1/approve", json={})).status_code == 403
    assert (await c.post("/api/requests/1/reject", json={})).status_code == 403
    assert (await c.post("/api/requests/1/bypass", json={"reason": "x"})).status_code == 403

    # onboarding approve (seed a real onboarding request so authz — not 404 — decides)
    onb = Request(
        kind="SERVICE_ONBOARDING", action="CREATE", resource_type="svc",
        owner_team="payments", payload={"definition_id": 1}, requester="carol",
        state="PENDING_APPROVAL", approval_policy={"mode": "SINGLE"}, approvals=[],
    )
    session.add(onb)
    await session.commit()
    assert (await c.post(f"/api/services/onboarding/{onb.id}/approve", json={})).status_code == 403
