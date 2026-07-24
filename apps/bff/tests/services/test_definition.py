"""ServiceDefinition model + pin-until-migrated versioning + retire guard (Task 1)."""

import pytest

from app.models.resource import ResourceIndex
from app.services import definition as d
from app.services.definition import RetireBlocked, ServiceDefinition

pytestmark = pytest.mark.anyio


def _mk(name: str, version: int, status: str = "ACTIVE") -> ServiceDefinition:
    return ServiceDefinition(
        name=name,
        category="data",
        owner_team="payments",
        form_schema={"type": "object", "properties": {"engine": {"type": "string"}}},
        ui_schema={},
        workflow_binding={"create": {"template_ref": "resource-change", "param_map": {}}},
        approval_policy={"mode": "SINGLE"},
        git_path=f"resources/{name}/",
        status=status,
        version=version,
    )


async def test_new_version_bumps(session):
    session.add(_mk("database", 1))
    await session.commit()
    nxt = await d.next_version(session, "database")
    assert nxt == 2
    session.add(_mk("database", nxt))
    await session.commit()
    # Both rows persist — the old version is not overwritten.
    assert await d.next_version(session, "database") == 3


async def test_existing_resource_resolves_pinned_version(session):
    session.add_all([_mk("database", 1), _mk("database", 2)])
    await session.commit()
    # A resource pinned to v1 keeps resolving v1 even though v2 is the latest.
    pinned = await d.resolve(session, "database", version=1)
    assert pinned is not None and pinned.version == 1
    latest = await d.resolve(session, "database")  # version=None -> latest active
    assert latest is not None and latest.version == 2


async def test_retire_blocked_while_resource_exists(session):
    session.add(_mk("database", 1))
    session.add(
        ResourceIndex(
            type="database",
            name="pg-prod",
            owner_team="payments",
            git_path="resources/database/pg-prod.json",
            git_sha="abc",
            payload={"spec": {}},
            definition_version=1,
        )
    )
    await session.commit()
    with pytest.raises(RetireBlocked):
        await d.retire(session, "database")
    # No live resources -> retire succeeds and marks the definition RETIRED.
    await session.delete(await session.get(ResourceIndex, 1))
    await session.commit()
    await d.retire(session, "database")
    row = await d.resolve(session, "database", version=1)
    assert row is not None and row.status == "RETIRED"
