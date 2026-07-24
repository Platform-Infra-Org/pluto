"""Task 3: startup reconciliation + stuck-workflow timeout.

Drives a fake Argo (no live cluster). A BFF-restart leaves a request EXECUTING;
reconcile re-attaches the watcher and reaches the correct terminal state. A
workflow we never see terminal gets force-FAILED past the max duration.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.argo.status import normalize_status
from app.execution.reconcile import fail_stuck_requests, reconcile_on_startup

from .conftest import FakeArgo, make_approved

pytestmark = pytest.mark.anyio


def _succeeded():
    return normalize_status({"metadata": {"name": "wf"}, "status": {"phase": "Succeeded", "nodes": {}}})


async def _executing(session, **over):
    req = await make_approved(session, **over)
    req.state = "EXECUTING"
    req.workflow_ref = "platform/wf"
    await session.commit()
    await session.refresh(req, ["events"])
    return req


async def _noop_reindex():
    return None


async def test_reconcile_drives_executing_to_terminal_via_get(session):
    """Restart mid-workflow: no stream, but GET reports Succeeded -> SUCCEEDED."""
    req = await _executing(session)
    argo = FakeArgo(stream=[], get_status=_succeeded())  # only GET has the truth

    n = await reconcile_on_startup(argo=argo, session=session, reindex=_noop_reindex)

    assert n == 1
    await session.refresh(req)
    assert req.state == "SUCCEEDED"


async def test_stuck_request_times_out_to_failed(session):
    req = await _executing(session)
    # Backdate updated_at so the guard sees it as long-stuck.
    old = datetime.now(UTC) - timedelta(hours=5)
    await session.execute(
        text("UPDATE request SET updated_at = :ts WHERE id = :id"),
        {"ts": old, "id": req.id},
    )
    await session.commit()

    n = await fail_stuck_requests(session, max_seconds=3600)

    assert n == 1
    await session.refresh(req)
    assert req.state == "FAILED"
    assert "max duration" in req.failure["message"]


async def test_fresh_executing_request_is_not_timed_out(session):
    req = await _executing(session)  # updated_at ~ now
    n = await fail_stuck_requests(session, max_seconds=3600)
    assert n == 0
    await session.refresh(req)
    assert req.state == "EXECUTING"
