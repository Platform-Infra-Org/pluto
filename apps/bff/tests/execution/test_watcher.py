"""Task 3: watcher maps Argo phase -> request state + persists the failed step.

Driven by a fake status stream (no live cluster). The failing case uses the
same failed_dag shape the E03 status tests use, so the persisted step is the
accurate leaf failure.
"""

import json
from pathlib import Path

import pytest

from app.argo.status import normalize_status
from app.execution.watcher import watch_request

from .conftest import FakeArgo, make_approved

pytestmark = pytest.mark.anyio

FAILED_DAG = json.loads(
    (Path(__file__).parents[1] / "argo" / "fixtures" / "failed_dag.json").read_text()
)


def _running():
    return normalize_status({"metadata": {"name": "wf"}, "status": {"phase": "Running", "nodes": {}}})


def _succeeded():
    return normalize_status({"metadata": {"name": "wf"}, "status": {"phase": "Succeeded", "nodes": {}}})


def _failed():
    return normalize_status(FAILED_DAG)


async def _noop_reindex():
    return None


async def _executing(session):
    req = await make_approved(session)
    req.state = "EXECUTING"
    req.workflow_ref = "platform/wf"
    await session.commit()
    await session.refresh(req, ["events"])
    return req


async def test_failing_stream_transitions_to_failed_with_step(session):
    req = await _executing(session)
    argo = FakeArgo(stream=[_running(), _failed()])

    await watch_request(req, argo, session, reindex=_noop_reindex)

    assert req.state == "FAILED"
    assert req.failure["node"] == "deploy-db"
    assert "could not connect to database" in req.failure["message"]
    assert req.failure["phase"] == "Failed"


async def test_succeeding_stream_transitions_to_succeeded(session):
    req = await _executing(session)
    argo = FakeArgo(stream=[_running(), _succeeded()])

    await watch_request(req, argo, session, reindex=_noop_reindex)

    assert req.state == "SUCCEEDED"
    assert req.failure is None


async def test_restart_mid_run_reconciles_via_get(session):
    # BFF restarted: the live stream is empty; terminal truth comes from GET.
    req = await _executing(session)
    argo = FakeArgo(stream=[], get_status=_failed())

    await watch_request(req, argo, session, reindex=_noop_reindex)

    assert req.state == "FAILED"
    assert req.failure["node"] == "deploy-db"
