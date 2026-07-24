"""SSE stream + multi-replica fan-out (E07 Task 3).

Fan-out uses Postgres LISTEN/NOTIFY: `notify()` fires `pg_notify` on commit;
each BFF replica keeps one asyncpg connection LISTENing on the channel and
pushes to the in-process SSE queues it holds. A notify raised on any replica
therefore reaches the replica holding the user's connection — no Redis.

Recipient keys: a principal's own `sub` plus their team names (team-scoped
notifications like APPROVAL_NEEDED are addressed to the owner team).
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from collections.abc import AsyncIterator, Callable

import asyncpg  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.auth.deps import current_principal
from app.auth.jwt import AuthError, verify_token
from app.auth.principal import Principal, build_principal
from app.config import settings
from app.db import get_session
from app.notifications import service
from app.notifications.model import Notification
from app.notifications.service import CHANNEL

log = logging.getLogger(__name__)

_PING_SECONDS = 15


def _dsn() -> str:
    # asyncpg wants a bare libpq DSN, not SQLAlchemy's "+asyncpg" dialect URL.
    return settings.database_url.replace("+asyncpg", "")


class Fanout:
    """LISTENs on the notifications channel and dispatches to per-key queues."""

    def __init__(self) -> None:
        self._conn: asyncpg.Connection | None = None
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)

    async def start(self) -> None:
        self._conn = await asyncpg.connect(_dsn())
        await self._conn.add_listener(CHANNEL, self._on_notify)

    async def stop(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None

    def _on_notify(self, _conn, _pid, _channel, payload: str) -> None:
        try:
            data = json.loads(payload)
        except ValueError:
            log.warning("bad notify payload: %r", payload)
            return
        for q in list(self._subs.get(data.get("user_id"), ())):
            q.put_nowait(data)

    def subscribe(self, keys: list[str]) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        for k in keys:
            self._subs[k].add(q)
        return q

    def unsubscribe(self, keys: list[str], q: asyncio.Queue) -> None:
        for k in keys:
            self._subs[k].discard(q)


# One fan-out per replica; started in the app lifespan.
fanout = Fanout()


def _sse(data: dict) -> dict:
    return {"event": "notification", "data": json.dumps(data)}


def _row(n: Notification) -> dict:
    return {
        "id": n.id,
        "user_id": n.user_id,
        "type": n.type,
        "request_id": n.request_id,
        "title": n.title,
        "body": n.body,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


async def event_stream(
    fan: Fanout,
    keys: list[str],
    session: AsyncSession,
    disconnected: Callable[[], bool],
) -> AsyncIterator[dict]:
    """Replay unread rows (persist-then-push), then stream live pushes."""
    q = fan.subscribe(keys)
    try:
        # Oldest-first so the client renders history in order; de-dups by id.
        unread = await service.list_notifications(session, keys, unread_only=True)
        for n in reversed(unread):
            yield _sse(_row(n))
        while not disconnected():
            try:
                data = await asyncio.wait_for(q.get(), timeout=_PING_SECONDS)
                yield _sse(data)
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": "{}"}  # keep the connection warm
    finally:
        fan.unsubscribe(keys, q)


def _keys(principal: Principal) -> list[str]:
    return [principal.sub, *sorted(principal.teams)]


router = APIRouter(prefix="/api/notifications")


async def _stream_principal(
    request: Request, access_token: str | None = None
) -> Principal:
    """Auth for SSE: native EventSource can't set an Authorization header, so the
    stream also accepts the bearer token as an `access_token` query param."""
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        token = header.split(" ", 1)[1]
    elif access_token:
        token = access_token
    else:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    try:
        claims = await verify_token(token)
    except AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token") from exc
    return build_principal(claims)


@router.get("/stream")
async def stream(
    request: Request,
    principal: Principal = Depends(_stream_principal),
    session: AsyncSession = Depends(get_session),
) -> EventSourceResponse:
    keys = _keys(principal)
    # sse-starlette cancels the generator (running its `finally`) on client
    # disconnect, so the loop itself never needs to poll for it.
    return EventSourceResponse(
        event_stream(fanout, keys, session, disconnected=lambda: False)
    )


@router.get("")
async def list_inbox(
    unread_only: int = 0,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    keys = _keys(principal)
    rows = await service.list_notifications(session, keys, unread_only=bool(unread_only))
    return {
        "items": [_row(n) for n in rows],
        "unread": await service.unread_count(session, keys),
    }


class ReadBody(BaseModel):
    ids: list[int] | None = None  # None => mark all unread read


@router.post("/read")
async def mark_read(
    body: ReadBody,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    keys = _keys(principal)
    ids = body.ids
    if ids is None:
        ids = [n.id for n in await service.list_notifications(session, keys, unread_only=True)]
    updated = await service.mark_read(session, keys, ids) if ids else 0
    return {"updated": updated, "unread": await service.unread_count(session, keys)}
