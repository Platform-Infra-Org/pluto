"""Requests DB-test fixtures. Uses compose Postgres (DATABASE_URL default).

Mirrors the catalog conftest: fresh engine per test so asyncpg's pool binds to
the test's own event loop; create tables from metadata (idempotent) and truncate.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models.base import Base
from app.models.request import Request, RequestEvent  # noqa: F401 — register tables
from app.models.resource import ResourceIndex  # noqa: F401 — register tables


@pytest.fixture
async def session():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("TRUNCATE request_event, request, resource_index RESTART IDENTITY")
        )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()
