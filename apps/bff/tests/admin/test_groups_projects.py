"""F3: local groups registry (JSON/CSV import) + projects mapped to a group.

All routes are platform-admin-only (the 403 sweep lives in test_admin_api.py).
Reuses the hardening conftest (compose Postgres + dependency overrides).
"""

import pytest

from tests.hardening.conftest import ADMIN

pytestmark = pytest.mark.anyio


async def test_import_json_array_creates_groups(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    r = await c.post("/api/admin/groups/import", content='["team-a", "team-b"]')
    assert r.status_code == 200
    assert r.json() == {"imported": 2, "skipped": 0}

    names = {g["name"] for g in (await c.get("/api/admin/groups")).json()["items"]}
    assert names == {"team-a", "team-b"}


async def test_import_json_objects_with_description(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    r = await c.post(
        "/api/admin/groups/import",
        content='[{"name": "team-a", "description": "the A team"}]',
    )
    assert r.status_code == 200
    items = (await c.get("/api/admin/groups")).json()["items"]
    assert items[0]["description"] == "the A team"
    assert items[0]["source"] == "import"


async def test_import_csv_creates_groups(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    csv_body = "name,description\nteam-a,A\nteam-b,B\n"
    r = await c.post("/api/admin/groups/import?format=csv", content=csv_body)
    assert r.status_code == 200
    assert r.json() == {"imported": 2, "skipped": 0}
    names = {g["name"] for g in (await c.get("/api/admin/groups")).json()["items"]}
    assert names == {"team-a", "team-b"}


async def test_reimport_is_idempotent(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    await c.post("/api/admin/groups/import", content='["team-a", "team-b"]')
    r = await c.post("/api/admin/groups/import", content='["team-a", "team-b", "team-c"]')
    assert r.json() == {"imported": 1, "skipped": 2}
    assert len((await c.get("/api/admin/groups")).json()["items"]) == 3


async def test_malformed_import_is_422(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    for body, fmt in [
        ("{not json", None),
        ('{"name": "x"}', None),  # object, not an array
        ("[123]", None),  # item is neither string nor object
        ("", None),  # empty
        ("wrong,cols\n1,2\n", "csv"),  # no name column
    ]:
        path = "/api/admin/groups/import" + (f"?format={fmt}" if fmt else "")
        r = await c.post(path, content=body)
        assert r.status_code == 422, f"{body!r} -> {r.status_code}"


async def test_create_project_maps_to_group(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    await c.post("/api/admin/groups/import", content='["team-a"]')
    r = await c.post(
        "/api/admin/projects",
        json={"name": "proj-x", "group_name": "team-a", "description": "d"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["group_name"] == "team-a"
    assert body["group_known"] is True  # team-a is in the registry

    items = (await c.get("/api/admin/projects")).json()["items"]
    assert items[0]["name"] == "proj-x"
    assert items[0]["group_name"] == "team-a"


async def test_create_project_allows_ldap_native_group(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    r = await c.post("/api/admin/projects", json={"name": "p", "group_name": "ldap-only"})
    assert r.status_code == 201
    assert r.json()["group_known"] is False  # not in registry, still allowed


async def test_duplicate_project_name_is_409(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    await c.post("/api/admin/projects", json={"name": "p", "group_name": "g"})
    r = await c.post("/api/admin/projects", json={"name": "p", "group_name": "g2"})
    assert r.status_code == 409


async def test_create_project_rejects_empty_group_name(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    r = await c.post("/api/admin/projects", json={"name": "p", "group_name": ""})
    assert r.status_code == 422


async def test_delete_project(client):
    c, holder, session = client
    holder["principal"] = ADMIN
    created = await c.post("/api/admin/projects", json={"name": "p", "group_name": "g"})
    pid = created.json()["id"]
    assert (await c.delete(f"/api/admin/projects/{pid}")).status_code == 204
    assert (await c.get("/api/admin/projects")).json()["items"] == []
