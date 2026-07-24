"""Dynamic-choice option source: external-API poller + Postgres cache (E08 Task 5).

A form's "dynamic choice" select reads its options from `cached_options`, never
live per render. The poller fetches each configured source on its own interval
(clamped >= 60s), maps the response to `{label, value}` pairs, and caches them.
On a failed refresh it keeps serving the **last-good** cache and marks it stale.
Sources are deduplicated by (url, method) so N fields share one fetch. Upstream
auth is a **secret reference** (env var name), never an inline credential.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

import httpx
from sqlalchemy import DateTime, UniqueConstraint, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

MIN_REFRESH_SECONDS = 60


class OptionSource(Base):
    __tablename__ = "option_source"
    # Dedup by source: one cached fetch per distinct (url, method).
    __table_args__ = (UniqueConstraint("url", "method", name="uq_option_source_url_method"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    url: Mapped[str]
    method: Mapped[str] = mapped_column(default="GET")
    # env var name holding the bearer token — NEVER the credential itself.
    auth_secret_ref: Mapped[str | None] = mapped_column(default=None)
    # {label_path, value_path, items_path?} — dotted paths into the response.
    mapping: Mapped[dict] = mapped_column(JSONB, default=dict)
    refresh_interval: Mapped[int] = mapped_column(default=MIN_REFRESH_SECONDS)
    cached_options: Mapped[list] = mapped_column(JSONB, default=list)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    last_status: Mapped[str] = mapped_column(default="pending")  # ok | stale | pending


def clamp_interval(seconds: int) -> int:
    """A misconfigured field can't hammer an external API: floor at 60s."""
    return max(int(seconds), MIN_REFRESH_SECONDS)


def _dig(obj: object, path: str) -> object:
    if not path:
        return obj
    cur = obj
    for part in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


def map_options(body: object, mapping: dict) -> list[dict]:
    """Map a JSON response to `[{label, value}, ...]` via dotted paths."""
    items = _dig(body, mapping.get("items_path", "")) if mapping.get("items_path") else body
    if not isinstance(items, list):
        items = []
    label_path = mapping.get("label_path", "label")
    value_path = mapping.get("value_path", "value")
    out = []
    for item in items:
        out.append(
            {"label": _dig(item, label_path), "value": _dig(item, value_path)}
        )
    return out


def _auth_headers(auth_secret_ref: str | None) -> dict[str, str]:
    if not auth_secret_ref:
        return {}
    token = os.environ.get(auth_secret_ref)  # secret resolved from env, never inline
    return {"Authorization": f"Bearer {token}"} if token else {}


async def get_or_create(
    session: AsyncSession, url: str, method: str = "GET", **kw
) -> OptionSource:
    """Dedup by (url, method): reuse an existing source or create one."""
    existing = await session.scalar(
        select(OptionSource).where(
            OptionSource.url == url, OptionSource.method == method
        )
    )
    if existing:
        return existing
    src = OptionSource(
        url=url,
        method=method,
        refresh_interval=clamp_interval(kw.pop("refresh_interval", MIN_REFRESH_SECONDS)),
        **kw,
    )
    session.add(src)
    await session.flush()
    return src


async def refresh(
    session: AsyncSession, source: OptionSource, client: httpx.AsyncClient
) -> OptionSource:
    """Fetch + map into the cache. On failure keep last-good and mark stale."""
    try:
        resp = await client.request(
            source.method,
            source.url,
            headers=_auth_headers(source.auth_secret_ref),
        )
        resp.raise_for_status()
        source.cached_options = map_options(resp.json(), source.mapping)
        source.last_status = "ok"
        source.last_synced_at = datetime.now(UTC)
    except Exception:  # noqa: BLE001 — a flaky upstream must never break the form
        source.last_status = "stale"  # keep serving cached_options (last-good)
    await session.commit()
    return source


async def poll_once(session: AsyncSession, client: httpx.AsyncClient) -> int:
    """Refresh every source whose interval has elapsed. Returns how many ran."""
    due = await due_sources(session)
    for src in due:
        await refresh(session, src, client)
    return len(due)


async def poll_loop(interval: int = MIN_REFRESH_SECONDS) -> None:
    """Background poller. ponytail: a plain sleep loop like the catalog reconcile
    loop — swap for a real scheduler only if per-source timing precision matters."""
    import asyncio
    import logging

    from app.db import async_session_factory

    log = logging.getLogger(__name__)
    while True:
        await asyncio.sleep(interval)
        try:
            async with async_session_factory() as session, httpx.AsyncClient() as client:
                await poll_once(session, client)
        except Exception:  # noqa: BLE001 — never let the poller die
            log.exception("option-source poll failed")


async def due_sources(session: AsyncSession) -> list[OptionSource]:
    """Sources whose interval has elapsed (or never synced) — poller work list."""
    now = datetime.now(UTC)
    rows = (await session.scalars(select(OptionSource))).all()
    due = []
    for s in rows:
        if s.last_synced_at is None:
            due.append(s)
            continue
        age = (now - s.last_synced_at).total_seconds()
        if age >= clamp_interval(s.refresh_interval):
            due.append(s)
    return due
