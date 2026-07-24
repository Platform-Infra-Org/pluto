"""Unit tests for ArgoClient against a mocked httpx transport (no live cluster).

Live-Argo acceptance is in test_client_integration below, SKIPPED unless
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


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def _client(handler) -> ArgoClient:
    return ArgoClient(
        base_url="https://argo.test:2746",
        namespace="platform",
        token="test-token",
        transport=httpx.MockTransport(handler),
    )


@pytest.mark.anyio
async def test_submit_request_shape():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["request"] = request
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"metadata": {"name": "deploy-abc12"}})

    client = _client(handler)
    ref = await client.submit(
        template="deploy-template",
        parameters={"target": "payments", "action": "deploy"},
        labels={"team": "payments"},
    )

    req = seen["request"]
    assert req.method == "POST"
    assert req.url.path == "/api/v1/workflows/platform/submit"
    assert req.headers["Authorization"] == "Bearer test-token"

    body = seen["body"]
    # body wraps under a top-level object (not bare params) [R caveat]
    assert body["namespace"] == "platform"
    assert body["resourceKind"] == "WorkflowTemplate"
    assert body["resourceName"] == "deploy-template"
    params = body["submitOptions"]["parameters"]
    assert "target=payments" in params and "action=deploy" in params

    labels = body["submitOptions"]["labels"]
    assert "team=payments" in labels
    assert "request-id=" in labels  # idempotency label auto-added

    assert ref == WorkflowRef(namespace="platform", name="deploy-abc12")


@pytest.mark.anyio
async def test_submit_sets_deterministic_name_not_generate_name():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"metadata": {"name": "req-42"}})

    client = _client(handler)
    await client.submit(template="t", parameters={}, labels={}, name="req-42")

    opts = seen["body"]["submitOptions"]
    assert opts["name"] == "req-42"  # deterministic name = idempotency key
    assert "generateName" not in opts  # not a random name


@pytest.mark.anyio
async def test_submit_raises_already_exists_on_409():
    from app.argo.models import WorkflowAlreadyExists

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"message": "workflows.argoproj.io already exists"})

    client = _client(handler)
    with pytest.raises(WorkflowAlreadyExists):
        await client.submit(template="t", parameters={}, labels={}, name="req-42")


@pytest.mark.anyio
async def test_submit_preserves_caller_request_id():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"metadata": {"name": "w1"}})

    client = _client(handler)
    await client.submit(
        template="t", parameters={}, labels={"request-id": "req-fixed-123"}
    )
    assert "request-id=req-fixed-123" in seen["body"]["submitOptions"]["labels"]


@pytest.mark.anyio
async def test_get_normalizes_failed_workflow():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/api/v1/workflows/platform/deploy-bad-xyz98"
        assert request.headers["Authorization"] == "Bearer test-token"
        return httpx.Response(200, json=_load("failed_dag.json"))

    client = _client(handler)
    ws = await client.get(WorkflowRef(namespace="platform", name="deploy-bad-xyz98"))
    assert ws.phase == "Failed"
    failed = find_failed_step(ws)
    assert failed is not None and failed.display_name == "deploy-db"


# --- Live-Argo acceptance (DEFERRED: needs a real cluster) -------------------
@pytest.mark.anyio
@pytest.mark.skipif(
    not os.getenv("ARGO_SERVER_URL"),
    reason="live Argo cluster not available (set ARGO_SERVER_URL)",
)
async def test_submit_and_get_against_real_argo():
    client = ArgoClient()
    ref = await client.submit(
        template=os.environ["ARGO_TEST_TEMPLATE"],
        parameters={"message": "hello"},
        labels={},
    )
    ws = await client.get(ref)
    assert ws.name == ref.name
    await client.aclose()
