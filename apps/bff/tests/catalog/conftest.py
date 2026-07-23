"""Catalog DB-test fixtures. Uses the compose Postgres (DATABASE_URL default).

The Alembic migration is verified separately by `alembic upgrade head`; here we
create the table from metadata (idempotent) so tests are self-contained. A fresh
engine per test keeps asyncpg's pool bound to the test's own event loop (anyio
runs each test in a new loop).
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models.base import Base
from app.models.resource import ResourceIndex  # noqa: F401 — register table


@pytest.fixture
async def session():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("TRUNCATE resource_index RESTART IDENTITY"))
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()
