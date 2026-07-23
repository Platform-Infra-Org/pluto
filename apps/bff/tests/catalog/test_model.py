import pytest
from sqlalchemy import select

from app.models.resource import ResourceIndex


@pytest.mark.anyio
async def test_insert_and_query_roundtrips_jsonb(session):
    payload = {"metadata": {"name": "orders-db", "ownerTeam": "payments"}, "spec": {"engine": "pg"}}
    session.add(
        ResourceIndex(
            type="database",
            name="orders-db",
            owner_team="payments",
            git_path="resources/database/orders-db.json",
            git_sha="abc123",
            payload=payload,
            status="active",
        )
    )
    await session.commit()

    row = (await session.execute(select(ResourceIndex).where(ResourceIndex.name == "orders-db"))).scalar_one()
    assert row.id is not None
    assert row.type == "database"
    assert row.owner_team == "payments"
    assert row.payload == payload  # jsonb round-trip
    assert row.payload["spec"]["engine"] == "pg"
    assert row.updated_at is not None
