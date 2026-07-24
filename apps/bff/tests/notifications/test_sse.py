"""Task 3: SSE stream + multi-replica fan-out via Postgres LISTEN/NOTIFY.

The cross-replica test opens a Fanout on its own Postgres connection ("replica
B") and fires a notify() from the test's session ("replica A", a different
connection). pg_notify on A must reach the LISTEN on B — proving fan-out works
across BFF replicas without shared process state or Redis.
"""

import asyncio
import inspect

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.notifications import service, sse
from app.notifications.sse import Fanout, event_stream

pytestmark = pytest.mark.anyio


def _factory(session):
    # A session factory bound to the test's engine so re-selects/replays run on
    # the test event loop and see the test's committed rows.
    return async_sessionmaker(session.bind, expire_on_commit=False)


async def test_notify_on_one_connection_reaches_listener_on_another(session):
    fan = Fanout(session_factory=_factory(session))  # "replica B": own LISTEN conn
    await fan.start()
    q = fan.subscribe(["alice"])
    try:
        # "replica A": notify from the test's separate session/connection.
        n = await service.notify(session, "alice", "APPROVAL_NEEDED", 5, "t", "b")
        data = await asyncio.wait_for(q.get(), timeout=5)
        # id-only NOTIFY: the listener re-selected the full row by id.
        assert data["id"] == n.id
        assert data["type"] == "APPROVAL_NEEDED"
        assert data["title"] == "t"  # full row, fetched by id — not in the payload
    finally:
        await fan.stop()


async def test_listener_only_delivers_to_matching_recipient(session):
    fan = Fanout(session_factory=_factory(session))
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
    async for ev in event_stream(
        fan, ["alice"], _factory(session), disconnected=lambda: True
    ):
        events.append(ev)

    # Oldest-first replay of the two unread rows, tagged as notification events.
    assert [e["event"] for e in events] == ["notification", "notification"]
    import json

    ids = [json.loads(e["data"])["request_id"] for e in events]
    assert ids == [1, 2]


async def test_stream_handler_takes_no_db_session(session):
    # Fix 1: the SSE handler must NOT depend on a request-scoped session, which
    # would pin a pooled connection for the whole stream lifetime.
    params = inspect.signature(sse.stream).parameters
    assert "session" not in params


async def test_event_stream_releases_replay_session_before_live_loop(session):
    # The replay session is borrowed only for its SELECT and released before the
    # live loop — proven by a factory that records when its session is closed.
    await service.notify(session, "alice", "REQUEST_APPROVED", 1, "first", "")
    inner = _factory(session)
    state = {"closed": False}

    class _Ctx:
        def __init__(self):
            self.cm = inner()

        async def __aenter__(self):
            return await self.cm.__aenter__()

        async def __aexit__(self, *a):
            state["closed"] = True
            return await self.cm.__aexit__(*a)

    fan = Fanout()
    events = []
    async for ev in event_stream(fan, ["alice"], lambda: _Ctx(), disconnected=lambda: True):
        # By the time replay events are produced, the borrowed session is closed.
        assert state["closed"] is True
        events.append(ev)
    assert len(events) == 1
    assert state["closed"] is True
