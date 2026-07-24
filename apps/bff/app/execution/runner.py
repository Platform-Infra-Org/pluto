"""Fire-and-forget execution runner: APPROVED -> submit -> watch to terminal.

Wiring glue that closes the loop in production. It is gated on `argo_server_url`
(like main.py's reconcile loop) so a cluster-less dev/test env never triggers a
real submit — the executor/watcher logic itself is unit-tested with a fake
ArgoClient. Live acceptance is DEFERRED (needs a real cluster).

ponytail: per-request asyncio tasks tracked in a module set so they aren't GC'd
mid-flight. This is fine for a single BFF process; if execution must survive a
BFF restart mid-run, promote it to a durable queue and reconcile via ArgoClient.get
on startup (the watcher already reconciles once per run).
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.argo.client import ArgoClient
from app.config import settings
from app.db import async_session_factory
from app.execution.executor import on_approved
from app.execution.watcher import watch_request
from app.models.request import Request

log = logging.getLogger(__name__)

_tasks: set[asyncio.Task] = set()


async def _run(request_id: int) -> None:
    async with async_session_factory() as session:
        stmt = (
            select(Request)
            .where(Request.id == request_id)
            .options(selectinload(Request.events))
        )
        req = (await session.execute(stmt)).scalar_one_or_none()
        if req is None or req.state not in ("APPROVED", "EXECUTING"):
            return
        argo = ArgoClient()
        try:
            await on_approved(req, argo, session)
            await watch_request(req, argo, session)
        finally:
            await argo.aclose()


def schedule_execution(request_id: int) -> None:
    """Kick off execution for a freshly-APPROVED request, if Argo is configured."""
    if not settings.argo_server_url:
        return  # no cluster wired — executor/watcher are unit-tested instead
    task = asyncio.create_task(_guarded(request_id))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def _guarded(request_id: int) -> None:
    try:
        await _run(request_id)
    except Exception:  # noqa: BLE001 — never let a background task crash silently
        log.exception("execution failed for request %s", request_id)
