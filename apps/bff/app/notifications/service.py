"""Notification service: persist, list, read-state (E07 Task 1).

`notify()` is persist-then-push: it writes the row and, in the same transaction,
fires `pg_notify` so the SSE fan-out (Task 3) delivers it live. The row is the
system of record; the push is the fast path.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.notifications.model import Notification

CHANNEL = "notifications"


def _keys(user_id: str | Iterable[str]) -> list[str]:
    return [user_id] if isinstance(user_id, str) else list(user_id)


async def notify(
    session: AsyncSession,
    user_id: str,
    type: str,
    request_id: int | None,
    title: str,
    body: str = "",
) -> Notification:
    """Persist a notification, then push an id-only Postgres NOTIFY.

    Persist-then-push, in two commits: the row is committed (durable) FIRST, so a
    failed push can never roll it back. The NOTIFY payload is id-only (Postgres
    caps NOTIFY at 8000 bytes; title/body are unbounded) — the fan-out listener
    re-selects the full row by id. The push is best-effort: if it raises, the row
    already exists and the REST inbox/replay still delivers it.
    """
    n = Notification(
        user_id=user_id, type=type, request_id=request_id, title=title, body=body
    )
    session.add(n)
    await session.commit()  # durable first — the row is the system of record

    # Small, bounded payload: just the id (routing key) so the listener can
    # re-select the row. Delivered to LISTENers only at COMMIT.
    payload = json.dumps({"id": n.id, "user_id": user_id})
    await session.execute(
        text("SELECT pg_notify(:chan, :payload)"),
        {"chan": CHANNEL, "payload": payload},
    )
    await session.commit()
    return n


async def list_notifications(
    session: AsyncSession, user_id: str | Iterable[str], unread_only: bool = False
) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(Notification.user_id.in_(_keys(user_id)))
        .order_by(Notification.id.desc())
    )
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    return list((await session.execute(stmt)).scalars())


async def unread_count(session: AsyncSession, user_id: str | Iterable[str]) -> int:
    stmt = select(func.count()).where(
        Notification.user_id.in_(_keys(user_id)),
        Notification.read_at.is_(None),
    )
    return (await session.execute(stmt)).scalar_one()


async def mark_read(
    session: AsyncSession, user_id: str | Iterable[str], ids: Iterable[int]
) -> int:
    """Flip read_at on the caller's own unread rows; returns rows touched."""
    stmt = (
        update(Notification)
        .where(
            Notification.user_id.in_(_keys(user_id)),
            Notification.id.in_(list(ids)),
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    result = await session.execute(stmt)
    await session.commit()
    return result.rowcount  # type: ignore[attr-defined]
