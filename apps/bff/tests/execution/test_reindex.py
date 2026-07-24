"""Task 4: after SUCCEEDED the watcher re-indexes the catalog (the workflow, not
the BFF, wrote to Git). Failure must NOT re-index. Default hook is sync_repo."""

import json
from pathlib import Path

import pytest

from app.argo.status import normalize_status
from app.catalog import index
from app.execution import watcher
from app.execution.watcher import watch_request
from app.models.resource import ResourceIndex

from .conftest import FakeArgo, make_approved

pytestmark = pytest.mark.anyio

FAILED_DAG = json.loads(
    (Path(__file__).parents[1] / "argo" / "fixtures" / "failed_dag.json").read_text()
)


async def _executing(session):
    req = await make_approved(session)
    req.state = "EXECUTING"
    req.workflow_ref = "platform/wf"
    await session.commit()
    await session.refresh(req, ["events"])
    return req


async def test_success_reindexes_and_index_reflects_change(session):
    req = await _executing(session)
    argo = FakeArgo(stream=[normalize_status({"metadata": {"name": "wf"}, "status": {"phase": "Succeeded"}})])

    calls = []

    async def fake_reindex():
        # Stand in for sync_repo pulling the workflow's freshly-committed resource.
        calls.append(1)
        await index.upsert(
            session, type="database", name="new-db", owner_team="payments",
            git_path="resources/database/new-db.json", git_sha="deadbeef",
            payload={"spec": {"engine": "pg"}}, status="active",
        )
        await session.commit()

    await watch_request(req, argo, session, reindex=fake_reindex)

    assert req.state == "SUCCEEDED"
    assert calls == [1]  # re-indexed exactly once
    row = await session.get(ResourceIndex, 1)
    assert row is not None and row.name == "new-db"  # index reflects the change


async def test_failure_does_not_reindex(session):
    req = await _executing(session)
    argo = FakeArgo(stream=[normalize_status(FAILED_DAG)])

    calls = []

    async def fake_reindex():
        calls.append(1)

    await watch_request(req, argo, session, reindex=fake_reindex)

    assert req.state == "FAILED"
    assert calls == []  # no Git write happened -> nothing to re-index


def test_default_reindex_is_sync_repo():
    # Prod wiring: the real catalog sync runs on success unless overridden.
    from app.catalog.git_sync import sync_repo
    import inspect

    default = inspect.signature(watch_request).parameters["reindex"].default
    assert default is sync_repo
    assert watcher.sync_repo is sync_repo
