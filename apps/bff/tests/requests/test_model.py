"""Task 1: request + audit models round-trip."""

import pytest
from sqlalchemy import select

from app.models.request import Request, RequestEvent

pytestmark = pytest.mark.anyio


async def test_request_event_round_trip(session):
    req = Request(
        kind="RESOURCE_CHANGE",
        action="UPDATE",
        resource_type="database",
        resource_id=7,
        owner_team="payments",
        payload={"spec": {"engine": "pg"}},
        requester="alice",
        state="PENDING_APPROVAL",
        approval_policy={"mode": "SINGLE"},
        approvals=[],
        base_git_sha="abc123",
    )
    req.events.append(
        RequestEvent(actor="alice", from_state=None, to_state="PENDING_APPROVAL", note="submit")
    )
    session.add(req)
    await session.commit()

    got = (await session.execute(select(Request))).scalar_one()
    assert got.state == "PENDING_APPROVAL"
    assert got.approval_policy == {"mode": "SINGLE"}
    assert got.workflow_ref is None  # execution wired in E06
    assert got.created_at is not None

    ev = (await session.execute(select(RequestEvent))).scalar_one()
    assert ev.request_id == got.id
    assert ev.to_state == "PENDING_APPROVAL"
    assert ev.flags == []
    assert ev.at is not None
