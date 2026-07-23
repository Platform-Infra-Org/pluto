"""Watch-stream tests: SSE parsing + reconnect/reconcile, driven by a fake
event stream (no live cluster). Proves the end-to-end failed-step path.

Live-Argo acceptance is test_watch_against_real_argo below, SKIPPED unless
ARGO_SERVER_URL is set — it needs a real cluster (an environment input).
"""

import json
import os
from pathlib import Path

import httpx
import pytest

from app.argo.client import ArgoClient
from app.argo.models import WorkflowRef
from app.argo.status import find_failed_step

FIXTURES = Path(__file__).parent / "fixtures"
NAME = "deploy-bad-xyz98"
REF = WorkflowRef(namespace="platform", name=NAME)


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def _sse_event(workflow_obj: dict) -> bytes:
    payload = {"result": {"type": "MODIFIED", "object": workflow_obj}}
    return f"data: {json.dumps(payload)}\n\n".encode()


def _running_obj() -> dict:
    return {"metadata": {"name": NAME}, "status": {"phase": "Running", "nodes": {}}}


def _client(handler) -> ArgoClient:
    return ArgoClient(
        base_url="https://argo.test:2746",
        namespace="platform",
        token="test-token",
        transport=httpx.MockTransport(handler),
    )


@pytest.mark.anyio
async def test_watch_streams_to_failure_and_reports_step():
    # Stream ends in the failed_dag status -> proves requirement (6) end-to-end.
    body = b": keep-alive\n\n" + _sse_event(_running_obj()) + _sse_event(_load("failed_dag.json"))

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/workflow-events/platform"
        assert request.headers["Authorization"] == "Bearer test-token"
        return httpx.Response(200, content=body)

    statuses = [ws async for ws in _client(handler).watch(REF)]

    assert [s.phase for s in statuses] == ["Running", "Failed"]
    failed = find_failed_step(statuses[-1])
    assert failed is not None and failed.display_name == "deploy-db"


@pytest.mark.anyio
async def test_watch_reconciles_via_get_when_stream_drops():
    # Stream ends non-terminal (Running only); watcher reconciles via GET.
    def handler(request: httpx.Request) -> httpx.Response:
        if "/workflow-events/" in request.url.path:
            return httpx.Response(200, content=_sse_event(_running_obj()))
        # the GET reconcile call
        assert request.url.path == f"/api/v1/workflows/platform/{NAME}"
        return httpx.Response(200, json=_load("failed_dag.json"))

    statuses = [ws async for ws in _client(handler).watch(REF, backoff=0)]

    assert statuses[-1].phase == "Failed"
    assert find_failed_step(statuses[-1]).display_name == "deploy-db"


@pytest.mark.anyio
async def test_watch_stops_on_success():
    body = _sse_event({"metadata": {"name": NAME}, "status": {"phase": "Succeeded", "nodes": {}}})

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=body)

    statuses = [ws async for ws in _client(handler).watch(REF)]
    assert [s.phase for s in statuses] == ["Succeeded"]


# --- Live-Argo acceptance (DEFERRED: needs a real cluster) -------------------
@pytest.mark.anyio
@pytest.mark.skipif(
    not os.getenv("ARGO_SERVER_URL"),
    reason="live Argo cluster not available (set ARGO_SERVER_URL)",
)
async def test_watch_failed_workflow_against_real_argo():
    # Submit a deliberately-failing template, watch to terminal, assert the step.
    client = ArgoClient()
    ref = await client.submit(
        template=os.environ["ARGO_FAIL_TEMPLATE"], parameters={}, labels={}
    )
    final = None
    async for ws in client.watch(ref):
        final = ws
    assert final is not None and final.phase in ("Failed", "Error")
    assert find_failed_step(final) is not None
    await client.aclose()
