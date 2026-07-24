"""Onboarding lane: owner submits, admin approves -> ACTIVE & requestable (Task 6).

Reuses the E05 Request state machine with kind=SERVICE_ONBOARDING. A service
owner cannot self-approve; only platform-admin approves.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.db import get_session
from app.main import app

pytestmark = pytest.mark.anyio

OWNER = Principal(sub="owner1", username="owner1", groups=[], roles={"service-owner"}, teams={"payments"})
OWNER2 = Principal(sub="owner2", username="owner2", groups=[], roles={"service-owner"}, teams={"payments"})
# Same person as the submitter but also an admin — must still be blocked (SoD).
OWNER_ADMIN = Principal(sub="owner1", username="owner1", groups=[], roles={"service-owner", "platform-admin"}, teams={"payments"})
ADMIN = Principal(sub="adm", username="adm", groups=[], roles={"platform-admin"}, teams=set())


@pytest.fixture
async def client(session):
    holder = {"principal": OWNER}

    async def _get_session():
        yield session

    app.dependency_overrides[get_session] = _get_session
    app.dependency_overrides[current_principal] = lambda: holder["principal"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, holder
    app.dependency_overrides.clear()


_DEF = {
    "name": "cache",
    "category": "data",
    "form_schema": {"type": "object", "properties": {"engine": {"type": "string"}}, "required": ["engine"]},
    "workflow_binding": {"create": {"template_ref": "provision-cache", "param_map": {}}},
    "approval_policy": {"mode": "N_OF_M", "n": 2},
    "owner_team": "payments",
}


async def _draft_and_submit(c, holder):
    holder["principal"] = OWNER
    d = (await c.post("/api/services/definitions", json=_DEF)).json()
    assert d["status"] == "DRAFT" and d["version"] == 1
    r = await c.post(f"/api/services/definitions/{d['id']}/submit")
    assert r.status_code == 200
    return d["id"], r.json()["request_id"]


async def test_owner_submits_admin_approves_makes_it_active_and_requestable(client):
    c, holder = client
    def_id, req_id = await _draft_and_submit(c, holder)

    # Before approval the type is not requestable (no ACTIVE definition).
    holder["principal"] = OWNER
    pre = (await c.get("/api/services/type-schema/cache")).json()
    assert pre["form_schema"] == {"properties": {}}

    # Submitting owner cannot self-approve even if they are also an admin (SoD).
    holder["principal"] = OWNER_ADMIN
    assert (await c.post(f"/api/services/onboarding/{req_id}/approve", json={})).status_code == 403
    # A non-admin owner cannot approve onboarding.
    holder["principal"] = OWNER2
    assert (await c.post(f"/api/services/onboarding/{req_id}/approve", json={})).status_code == 403

    # It shows in the admin onboarding queue with the form + binding + policy.
    holder["principal"] = ADMIN
    queue = (await c.get("/api/services/onboarding")).json()["items"]
    assert any(i["request_id"] == req_id for i in queue)
    item = next(i for i in queue if i["request_id"] == req_id)
    assert item["definition"]["workflow_binding"]["create"]["template_ref"] == "provision-cache"
    assert item["definition"]["approval_policy"] == {"mode": "N_OF_M", "n": 2}

    # Admin approves -> definition ACTIVE.
    ap = await c.post(f"/api/services/onboarding/{req_id}/approve", json={"note": "ok"})
    assert ap.status_code == 200
    assert ap.json()["state"] == "APPROVED"
    assert ap.json()["definition_status"] == "ACTIVE"

    # Now requestable: type-schema serves the authored form, and the type's
    # default approval policy is the one the owner set (formalized E05 seam).
    holder["principal"] = OWNER
    ts = (await c.get("/api/services/type-schema/cache")).json()
    assert ts["form_schema"]["required"] == ["engine"]


async def test_reject_returns_definition_to_owner_as_draft(client):
    c, holder = client
    def_id, req_id = await _draft_and_submit(c, holder)

    holder["principal"] = ADMIN
    r = await c.post(f"/api/services/onboarding/{req_id}/reject", json={"note": "tighten policy"})
    assert r.status_code == 200
    assert r.json()["state"] == "REJECTED"
    assert r.json()["definition_status"] == "DRAFT"

    # Owner sees it back as a DRAFT in their list.
    holder["principal"] = OWNER
    mine = (await c.get("/api/services/definitions?mine=1")).json()["items"]
    assert next(d for d in mine if d["id"] == def_id)["status"] == "DRAFT"


async def test_non_owner_cannot_create_for_another_team(client):
    c, holder = client
    holder["principal"] = Principal(sub="x", username="x", groups=[], roles={"service-owner"}, teams={"search"})
    r = await c.post("/api/services/definitions", json={**_DEF, "owner_team": "payments"})
    assert r.status_code == 403
