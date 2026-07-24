"""Task 3: SSE stream + multi-replica fan-out via Postgres LISTEN/NOTIFY.

The cross-replica test opens a Fanout on its own Postgres connection ("replica
B") and fires a notify() from the test's session ("replica A", a different
connection). pg_notify on A must reach the LISTEN on B — proving fan-out works
across BFF replicas without shared process state or Redis.
"""

import asyncio

import pytest

from app.notifications import service
from app.notifications.sse import Fanout, event_stream

pytestmark = pytest.mark.anyio


async def test_notify_on_one_connection_reaches_listener_on_another(session):
    fan = Fanout()  # "replica B": its own LISTEN connection
    await fan.start()
    q = fan.subscribe(["alice"])
    try:
        # "replica A": notify from the test's separate session/connection.
        n = await service.notify(session, "alice", "APPROVAL_NEEDED", 5, "t", "b")
        data = await asyncio.wait_for(q.get(), timeout=5)
        assert data["id"] == n.id
        assert data["type"] == "APPROVAL_NEEDED"
    finally:
        await fan.stop()


async def test_listener_only_delivers_to_matching_recipient(session):
    fan = Fanout()
    await fan.start()
    q = fan.subscribe(["bob"])  # bob is listening, notification is for alice
    try:
        await service.notify(session, "alice", "APPROVAL_NEEDED", 5, "t", "b")
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(q.get(), timeout=0.5)
    finally:
        await fan.stop()


async def test_event_stream_replays_unread_on_connect(session):
    await service.notify(session, "alice", "REQUEST_APPROVED", 1, "first", "")
    await service.notify(session, "alice", "REQUEST_REJECTED", 2, "second", "")

    fan = Fanout()  # not started; replay reads from DB, not the queue
    events = []
    async for ev in event_stream(fan, ["alice"], session, disconnected=lambda: True):
        events.append(ev)

    # Oldest-first replay of the two unread rows, tagged as notification events.
    assert [e["event"] for e in events] == ["notification", "notification"]
    import json
    ids = [json.loads(e["data"])["request_id"] for e in events]
    assert ids == [1, 2]
