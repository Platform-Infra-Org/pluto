import pytest
from sqlalchemy import select

from app.catalog.git_sync import sync_repo
from app.models.resource import ResourceIndex


@pytest.mark.anyio
async def test_sync_indexes_valid_and_flags_invalid(session, git_fixture, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "git_repo_url", git_fixture["src"])
    monkeypatch.setattr(settings, "git_branch", git_fixture["branch"])
    monkeypatch.setattr(settings, "git_cache_dir", str(tmp_path / "cache"))

    report = await sync_repo(session)

    assert report.indexed == 2
    assert report.invalid == 1
    assert report.deleted == 0

    rows = {r.name: r for r in (await session.execute(select(ResourceIndex))).scalars()}
    assert set(rows) == {"orders-db", "sessions", "broken"}

    assert rows["orders-db"].status == "active"
    assert rows["orders-db"].type == "database"
    assert rows["orders-db"].owner_team == "payments"
    assert rows["orders-db"].git_sha == git_fixture["sha"]
    assert rows["orders-db"].payload["spec"]["engine"] == "pg"

    assert rows["sessions"].owner_team == "search"

    # Invalid file is surfaced, not dropped, and keeps its resolved owner team.
    assert rows["broken"].status == "invalid"
    assert rows["broken"].owner_team == "search"


@pytest.mark.anyio
async def test_sync_deletes_rows_for_vanished_files(session, git_fixture, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "git_repo_url", git_fixture["src"])
    monkeypatch.setattr(settings, "git_branch", git_fixture["branch"])
    monkeypatch.setattr(settings, "git_cache_dir", str(tmp_path / "cache"))

    await sync_repo(session)

    # Remove a file in source and re-commit, then re-sync.
    import os

    repo = git_fixture["repo"]
    os.remove(repo.working_tree_dir + "/resources/cache/sessions.json")
    repo.index.remove(["resources/cache/sessions.json"])
    repo.index.commit("drop sessions")

    report = await sync_repo(session)
    assert report.deleted == 1
    names = {r.name for r in (await session.execute(select(ResourceIndex))).scalars()}
    assert "sessions" not in names
