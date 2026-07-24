"""Blocks DB-test fixtures (CB01). Compose Postgres, fresh engine per test.

Mirrors the services conftest: create tables from metadata (idempotent) and
truncate so each test starts clean.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.blocks.model import FunctionBlock  # noqa: F401 — register table
from app.config import settings
from app.models.base import Base
from app.services.definition import ServiceDefinition  # noqa: F401 — register table


@pytest.fixture
async def session():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("TRUNCATE function_block, service_definition RESTART IDENTITY")
        )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()
