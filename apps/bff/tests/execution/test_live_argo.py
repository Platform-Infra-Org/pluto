"""E06 live-Argo acceptance — DEFERRED: needs a real Argo cluster.

Skipped unless ARGO_SERVER_URL is set (an environment input, not available here).
Exercises the full loop the fakes stub out: submit the bound template, watch it
to a terminal phase, and assert the request reaches SUCCEEDED / FAILED with the
failed step recorded. The unit tests (test_executor / test_watcher) cover the
same logic with a fake ArgoClient + fake status stream.
"""

import os

import pytest

from app.argo.client import ArgoClient
from app.execution.executor import on_approved
from app.execution.watcher import watch_request

from .conftest import make_approved

pytestmark = pytest.mark.anyio


@pytest.mark.skipif(
    not os.getenv("ARGO_SERVER_URL"),
    reason="live Argo cluster not available (set ARGO_SERVER_URL)",
)
async def test_approved_request_executes_to_terminal_against_real_argo(session):
    req = await make_approved(session)
    argo = ArgoClient()
    try:
        await on_approved(req, argo, session)
        assert req.state == "EXECUTING" and req.workflow_ref
        await watch_request(req, argo, session, reindex=lambda: _noop())
    finally:
        await argo.aclose()
    assert req.state in ("SUCCEEDED", "FAILED")
    if req.state == "FAILED":
        assert req.failure and req.failure["message"]


async def _noop():
    return None
