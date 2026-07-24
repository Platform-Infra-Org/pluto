"""Task 2: domain event -> recipient mapping, and its wiring into E05/E06."""

import pytest

from app.argo.status import normalize_status
from app.execution.watcher import watch_request
from app.models.request import Request
from app.notifications import events, service

from ..execution.conftest import FakeArgo, make_approved

pytestmark = pytest.mark.anyio


def _req(**over) -> Request:
    base = dict(
        id=42,
        kind="RESOURCE_CHANGE",
        action="UPDATE",
        resource_type="database",
        owner_team="payments",
        requester="bob",
        state="PENDING_APPROVAL",
    )
    base.update(over)
    return Request(**base)


async def test_submitted_notifies_owner_team(session):
    await events.request_submitted(session, _req())
    team = await service.list_notifications(session, "payments")
    assert [n.type for n in team] == ["APPROVAL_NEEDED"]
    assert team[0].request_id == 42
    # requester is not an approver recipient
    assert await service.list_notifications(session, "bob") == []


async def test_approved_and_rejected_notify_requester(session):
    await events.request_approved(session, _req(state="APPROVED"))
    await events.request_rejected(session, _req(id=43, state="REJECTED"))
    bob = await service.list_notifications(session, "bob")
    assert {n.type for n in bob} == {"REQUEST_APPROVED", "REQUEST_REJECTED"}


async def test_workflow_succeeded_notifies_requester(session):
    await events.workflow_succeeded(session, _req(state="SUCCEEDED"))
    bob = await service.list_notifications(session, "bob")
    assert [n.type for n in bob] == ["WORKFLOW_SUCCEEDED"]


async def test_workflow_failed_includes_step(session):
    req = _req(state="FAILED", failure={"node": "deploy-db", "message": "boom", "phase": "Failed"})
    await events.workflow_failed(session, req)
    bob = await service.list_notifications(session, "bob")
    assert bob[0].type == "WORKFLOW_FAILED"
    assert "deploy-db" in bob[0].body


# --- Wiring: E06 watcher terminal states produce notifications ---


async def _executing(session):
    req = await make_approved(session)
    req.state = "EXECUTING"
    req.workflow_ref = "platform/wf"
    await session.commit()
    await session.refresh(req, ["events"])
    return req


async def _noop_reindex():
    return None


async def test_watcher_success_notifies_requester(session):
    req = await _executing(session)
    succeeded = normalize_status({"metadata": {"name": "wf"}, "status": {"phase": "Succeeded", "nodes": {}}})
    await watch_request(req, FakeArgo(stream=[succeeded]), session, reindex=_noop_reindex)

    rows = await service.list_notifications(session, req.requester)
    assert [n.type for n in rows] == ["WORKFLOW_SUCCEEDED"]
    assert rows[0].request_id == req.id
