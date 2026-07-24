"""Execution DB-test fixtures + fakes (no live Argo cluster).

Mirrors the requests conftest: fresh engine per test bound to the test's own
event loop, tables created from metadata, truncated. `FakeArgo` records submits
and drives a scripted status stream so the executor/watcher are unit-tested
without Kubernetes.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.argo.models import WorkflowRef, WorkflowStatus
from app.config import settings
from app.models.base import Base
from app.models.request import Request, RequestEvent  # noqa: F401 — register tables
from app.models.resource import ResourceIndex  # noqa: F401 — register tables


class FakeArgo:
    """Injectable stand-in for ArgoClient.

    - `submit` records calls and returns a fixed ref (`submits` counts them).
    - `watch` yields the scripted `stream` statuses.
    - `get` returns `get_status` (used for restart/reconcile).
    """

    def __init__(
        self,
        *,
        ref: WorkflowRef | None = None,
        stream: list[WorkflowStatus] | None = None,
        get_status: WorkflowStatus | None = None,
    ) -> None:
        self.ref = ref or WorkflowRef(namespace="platform", name="wf-abc123")
        self.stream = stream or []
        self.get_status = get_status
        self.submits: list[dict] = []

    async def submit(self, template, parameters, labels, name=None):
        self.submits.append(
            {"template": template, "parameters": parameters, "labels": labels, "name": name}
        )
        return self.ref

    async def watch(self, ref, backoff: float = 1.0):
        for ws in self.stream:
            yield ws

    async def get(self, ref):
        return self.get_status


@pytest.fixture
async def session():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("TRUNCATE request_event, request, resource_index RESTART IDENTITY")
        )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()


async def make_approved(session, **over) -> Request:
    """Persist an APPROVED request ready to execute."""
    req = Request(
        kind="RESOURCE_CHANGE",
        action=over.get("action", "UPDATE"),
        resource_type=over.get("resource_type", "database"),
        resource_id=over.get("resource_id"),
        owner_team="payments",
        payload=over.get("payload", {"spec": {"engine": "pg16"}}),
        requester="bob",
        state="APPROVED",
        approval_policy={"mode": "SINGLE"},
        approvals=[{"approver_id": "alice", "at": "t", "note": None}],
    )
    session.add(req)
    await session.commit()
    await session.refresh(req, ["events"])
    return req
