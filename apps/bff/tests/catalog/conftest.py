"""Catalog DB-test fixtures. Uses the compose Postgres (DATABASE_URL default).

The Alembic migration is verified separately by `alembic upgrade head`; here we
create the table from metadata (idempotent) so tests are self-contained. A fresh
engine per test keeps asyncpg's pool bound to the test's own event loop (anyio
runs each test in a new loop).
"""

import json
from pathlib import Path

import pytest
from git import Actor, Repo
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models.base import Base
from app.models.resource import ResourceIndex  # noqa: F401 — register table


def _write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj) if not isinstance(obj, str) else obj)


@pytest.fixture
def git_fixture(tmp_path) -> dict:
    """A local git repo laid out as resources/<type>/<name>.json with 2 valid +
    1 invalid (parses, but no `spec`) file, each carrying a resolvable ownerTeam.
    Returns the source path, branch and HEAD sha."""
    src = tmp_path / "catalog-src"
    src.mkdir()
    repo = Repo.init(src)
    _write(src / "resources/database/orders-db.json",
           {"kind": "database", "metadata": {"ownerTeam": "payments"}, "spec": {"engine": "pg"}})
    _write(src / "resources/cache/sessions.json",
           {"kind": "cache", "metadata": {"ownerTeam": "search"}, "spec": {"ttl": 60}})
    # Invalid: valid JSON, resolvable owner, but missing required `spec`.
    _write(src / "resources/database/broken.json",
           {"kind": "database", "metadata": {"ownerTeam": "search"}})
    repo.index.add(["resources"])
    actor = Actor("Test", "test@example.com")
    commit = repo.index.commit("init catalog", author=actor, committer=actor)
    repo.git.branch("-M", "main")
    return {"src": str(src), "branch": "main", "sha": commit.hexsha, "repo": repo}


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
