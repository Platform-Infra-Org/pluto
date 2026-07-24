"""Task 1: notification persistence + list + read-state."""

import pytest

from app.notifications import service
from app.notifications.model import Notification

pytestmark = pytest.mark.anyio


async def test_notify_persists_a_row(session):
    n = await service.notify(
        session, "alice", "APPROVAL_NEEDED", 7, "needs approval", "please review"
    )
    assert n.id is not None
    assert n.user_id == "alice"
    assert n.type == "APPROVAL_NEEDED"
    assert n.request_id == 7
    assert n.read_at is None
    assert n.created_at is not None

    got = await session.get(Notification, n.id)
    assert got is not None and got.title == "needs approval"


async def test_list_and_unread_only(session):
    await service.notify(session, "alice", "REQUEST_APPROVED", 1, "a", "")
    await service.notify(session, "alice", "REQUEST_REJECTED", 2, "b", "")
    await service.notify(session, "bob", "REQUEST_APPROVED", 3, "c", "")

    alice = await service.list_notifications(session, "alice")
    assert [n.request_id for n in alice] == [2, 1]  # newest first

    # a team/other key is not visible to alice
    assert await service.list_notifications(session, "bob") != alice


async def test_mark_read_flips_read_at_and_unread_count(session):
    n1 = await service.notify(session, "alice", "REQUEST_APPROVED", 1, "a", "")
    n2 = await service.notify(session, "alice", "REQUEST_REJECTED", 2, "b", "")

    assert await service.unread_count(session, "alice") == 2

    updated = await service.mark_read(session, "alice", [n1.id])
    assert updated == 1
    assert await service.unread_count(session, "alice") == 1

    unread = await service.list_notifications(session, "alice", unread_only=True)
    assert [n.id for n in unread] == [n2.id]


async def test_mark_read_only_touches_own_rows(session):
    other = await service.notify(session, "bob", "REQUEST_APPROVED", 9, "x", "")
    updated = await service.mark_read(session, "alice", [other.id])
    assert updated == 0
    assert await service.unread_count(session, "bob") == 1


async def test_list_accepts_multiple_recipient_keys(session):
    await service.notify(session, "alice", "REQUEST_APPROVED", 1, "own", "")
    await service.notify(session, "payments", "APPROVAL_NEEDED", 2, "team", "")

    rows = await service.list_notifications(session, ["alice", "payments"])
    assert {n.request_id for n in rows} == {1, 2}
    assert await service.unread_count(session, ["alice", "payments"]) == 2
