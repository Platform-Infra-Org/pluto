"""Task 2: admin dashboard aggregation APIs. All require platform-admin.

Reuses the hardening conftest (compose Postgres + dependency overrides).
"""

import pytest

from app.models.request import Request
from app.models.resource import ResourceIndex
from app.services.definition import ServiceDefinition
from app.services.fields.option_source import OptionSource

from tests.hardening.conftest import ADMIN, AUDITOR, REQUESTER

pytestmark = pytest.mark.anyio

ADMIN_ROUTES = [
    "/api/admin/overview",
    "/api/admin/requests",
    "/api/admin/services",
    "/api/admin/workflows",
    "/api/admin/rbac",
    "/api/admin/ownership",
    "/api/admin/option-sources",
]


async def _seed(session):
    session.add_all([
        Request(kind="RESOURCE_CHANGE", action="UPDATE", resource_type="database",
                owner_team="payments", payload={}, requester="bob",
                state="PENDING_APPROVAL", approval_policy={"mode": "SINGLE"}, approvals=[]),
        Request(kind="RESOURCE_CHANGE", action="CREATE", resource_type="topic",
                owner_team="search", payload={}, requester="carol",
                state="SUCCEEDED", approval_policy={"mode": "SINGLE"}, approvals=[],
                workflow_ref="platform/wf-1"),
        Request(kind="RESOURCE_CHANGE", action="DELETE", resource_type="topic",
                owner_team="search", payload={}, requester="dan",
                state="FAILED", approval_policy={"mode": "SINGLE"}, approvals=[],
                workflow_ref="platform/wf-2",
                failure={"node": "commit", "message": "boom", "phase": "Failed"}),
        Request(kind="SERVICE_ONBOARDING", action="CREATE", resource_type="svc",
                owner_team="payments", payload={"definition_id": 1}, requester="eve",
                state="PENDING_APPROVAL", approval_policy={"mode": "SINGLE"}, approvals=[]),
    ])
    session.add(ResourceIndex(type="database", name="bad", owner_team="payments",
                              git_path="resources/database/bad.json", git_sha="s",
                              payload={"_error": "x"}, status="invalid"))
    session.add(ServiceDefinition(name="svc", owner_team="payments", status="PENDING_ONBOARDING",
                                  form_schema={}, version=1))
    session.add(OptionSource(url="http://x/api", method="GET", last_status="stale",
                             cached_options=[]))
    await session.commit()


async def test_every_admin_route_is_403_for_non_admin(client):
    c, holder, session = client
    for principal in (REQUESTER, AUDITOR):  # auditor reads audit, NOT admin console
        holder["principal"] = principal
        for route in ADMIN_ROUTES:
            r = await c.get(route)
            assert r.status_code == 403, f"{route} for {principal.sub} -> {r.status_code}"


async def test_overview_tiles(client):
    c, holder, session = client
    await _seed(session)
    holder["principal"] = ADMIN
    r = await c.get("/api/admin/overview")
    assert r.status_code == 200
    body = r.json()
    assert body["requests_by_state"]["PENDING_APPROVAL"] == 2
    assert body["requests_by_state"]["SUCCEEDED"] == 1
    assert body["pending_onboarding"] == 1
    assert body["workflow_success_rate"] == 0.5  # 1 succeeded of 2 terminal
    assert body["option_source_staleness"] == 1
    assert body["invalid_catalog_files"] == 1


async def test_requests_all_teams_with_filters(client):
    c, holder, session = client
    await _seed(session)
    holder["principal"] = ADMIN

    r = await c.get("/api/admin/requests")
    assert {i["owner_team"] for i in r.json()["items"]} == {"payments", "search"}

    r = await c.get("/api/admin/requests", params={"team": "search"})
    assert all(i["owner_team"] == "search" for i in r.json()["items"])

    r = await c.get("/api/admin/requests", params={"kind": "SERVICE_ONBOARDING"})
    assert all(i["kind"] == "SERVICE_ONBOARDING" for i in r.json()["items"])


async def test_workflows_surface_failed_steps(client):
    c, holder, session = client
    await _seed(session)
    holder["principal"] = ADMIN
    r = await c.get("/api/admin/workflows")
    assert r.status_code == 200
    failed = [i for i in r.json()["items"] if i["state"] == "FAILED"]
    assert failed and failed[0]["failure"]["message"] == "boom"


async def test_rbac_returns_role_group_map(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    r = await c.get("/api/admin/rbac")
    assert r.status_code == 200
    assert "platform-admins" in r.json()["role_group_map"]


async def test_option_source_health(client):
    c, holder, session = client
    await _seed(session)
    holder["principal"] = ADMIN
    r = await c.get("/api/admin/option-sources")
    items = r.json()["items"]
    assert items and items[0]["last_status"] == "stale"


async def test_editing_ownership_changes_routing(client):
    """PUT ownership -> a new CREATE request routes to the newly-configured team."""
    c, holder, session = client
    holder["principal"] = ADMIN
    put = await c.put("/api/admin/ownership", json={"default_team": "search", "path_map": {}})
    assert put.status_code == 200

    # A requester submits a CREATE with no ownerTeam metadata.
    holder["principal"] = REQUESTER
    r = await c.post("/api/requests", json={
        "action": "CREATE", "resource_type": "database", "payload": {"spec": {}},
    })
    assert r.status_code == 201
    assert r.json()["owner_team"] == "search"  # routing followed the edited map


async def test_admin_onboarding_approve(client):
    c, holder, session = client
    await _seed(session)  # definition id 1, onboarding request present
    holder["principal"] = ADMIN
    # find the onboarding request id
    r = await c.get("/api/admin/requests", params={"kind": "SERVICE_ONBOARDING"})
    onb_id = r.json()["items"][0]["id"]
    ap = await c.post(f"/api/admin/services/onboarding/{onb_id}/approve", json={})
    assert ap.status_code == 200
    assert ap.json()["definition_status"] == "ACTIVE"
