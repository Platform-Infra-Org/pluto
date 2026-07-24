"""Startup reconciliation + stuck-workflow timeout (E09 Task 3).

A BFF restart mid-workflow must never lose the outcome. On startup we find every
request left `EXECUTING` and re-attach the watcher — which reconciles against the
durable truth (`ArgoClient.get` + status.nodes) and drives it to SUCCEEDED/FAILED.
Idempotency of the submit itself is the deterministic Argo name in `executor`
(a retry hits AlreadyExists, never a double-submit) — reconcile only observes.

The max-duration guard flips a request that has been `EXECUTING` longer than
`max_execution_seconds` to FAILED with a clear message, so a workflow whose events
we never see doesn't hang in-flight forever.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.argo.client import ArgoClient
from app.catalog.git_sync import sync_repo
from app.config import settings
from app.db import async_session_factory
from app.execution.watcher import _Argo, watch_request
from app.models.request import Request
from app.notifications import events
from app.requests.state import transition

log = logging.getLogger(__name__)


async def _executing(session: AsyncSession) -> list[Request]:
    stmt = (
        select(Request)
        .where(Request.state == "EXECUTING")
        .options(selectinload(Request.events))
    )
    return list((await session.execute(stmt)).scalars())


async def fail_stuck_requests(
    session: AsyncSession,
    max_seconds: int | None = None,
    now: datetime | None = None,
) -> int:
    """Flip EXECUTING requests older than the max duration to FAILED. Returns count.

    ponytail: this only updates our DB row — it does NOT terminate the actual
    Argo workflow. So on timeout the workflow may keep running and still
    succeed (commit to Git) after we've already recorded FAILED, leaving DB and
    Git out of sync. The correct fix is to call Argo's terminate API here (add
    it to ArgoClient); deferred because it needs a live cluster to test against.
    """
    max_seconds = settings.max_execution_seconds if max_seconds is None else max_seconds
    now = now or datetime.now(UTC)
    cutoff = now - timedelta(seconds=max_seconds)
    stuck = 0
    for req in await _executing(session):
        if req.updated_at and req.updated_at < cutoff:
            req.failure = {
                "node": None,
                "message": f"workflow exceeded max duration of {max_seconds}s; marked FAILED",
                "phase": "TimedOut",
            }
            transition(req, "fail", actor="system", note="max-duration timeout")
            await session.commit()
            await events.notify_safe(events.workflow_failed, session, req)
            stuck += 1
    return stuck


async def reconcile_on_startup(
    argo: _Argo | None = None,
    session: AsyncSession | None = None,
    reindex: Callable[[], Awaitable] = sync_repo,
) -> int:
    """Re-attach a watcher to every in-flight (EXECUTING) request. Returns count.

    Best-effort: a failure on one request never blocks the others or startup.
    """
    own_session = session is None
    session = session or async_session_factory()
    own_argo = argo is None
    argo = argo or ArgoClient()
    reconciled = 0
    try:
        for req in await _executing(session):
            try:
                await watch_request(req, argo, session, reindex)
                reconciled += 1
            except Exception:  # noqa: BLE001 — one bad request must not abort reconcile
                log.exception("reconcile failed for request %s", req.id)
        await fail_stuck_requests(session)
        return reconciled
    finally:
        if own_argo:
            await argo.aclose()  # type: ignore[union-attr]
        if own_session:
            await session.close()
