"""Shared fixtures for hardening/admin API tests (compose Postgres)."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.config import settings
from app.db import get_session
from app.main import app
from app.models.base import Base
from app.models.request import Request, RequestEvent  # noqa: F401 register tables
from app.models.resource import ResourceIndex  # noqa: F401 register tables
from app.services.definition import ServiceDefinition  # noqa: F401 register tables
from app.services.fields.option_source import OptionSource  # noqa: F401 register tables

REQUESTER = Principal(sub="bob", username="bob", groups=[], roles={"requester"}, teams={"payments"})
ADMIN = Principal(sub="adm", username="adm", groups=[], roles={"platform-admin"}, teams=set())
AUDITOR = Principal(sub="aud", username="aud", groups=[], roles={"auditor"}, teams=set())


@pytest.fixture
async def session():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "TRUNCATE request_event, request, resource_index, "
                "service_definition, option_source RESTART IDENTITY"
            )
        )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()


@pytest.fixture
async def client(session):
    holder = {"principal": AUDITOR}

    async def _get_session():
        yield session

    app.dependency_overrides[get_session] = _get_session
    app.dependency_overrides[current_principal] = lambda: holder["principal"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, holder, session
    app.dependency_overrides.clear()
