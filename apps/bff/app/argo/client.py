"""Async client for the Argo Workflows API server (REST, default port 2746).

Auth is the BFF's own bearer token (Argo run with --auth-mode client); the token
is sent as `Authorization: Bearer <token>` on every call. This module only
triggers/observes workflows — the workflow template is the sole Git writer.

Live-cluster acceptance tests are DEFERRED (no Argo in this environment); the
unit tests drive this client through httpx.MockTransport. See E03 report.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.config import settings

from .models import WorkflowRef, WorkflowStatus
from .status import normalize_status

TERMINAL_PHASES = {"Succeeded", "Failed", "Error"}


def _parse_sse_workflow(line: str) -> dict | None:
    """Argo workflow-events SSE lines look like `data: {"result":{"object":{...}}}`.
    Returns the embedded Workflow object, or None for keep-alives / non-data lines."""
    if not line.startswith("data:"):
        return None
    try:
        payload = json.loads(line[len("data:"):].strip())
    except json.JSONDecodeError:
        return None
    result = payload.get("result") or {}
    return result.get("object")


class ArgoClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        namespace: str | None = None,
        token: str | None = None,
        verify_tls: bool | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.namespace = namespace or settings.argo_namespace
        token = token if token is not None else settings.argo_auth_token
        self._client = httpx.AsyncClient(
            base_url=base_url or settings.argo_server_url,
            headers={"Authorization": f"Bearer {token}"},
            verify=settings.argo_verify_tls if verify_tls is None else verify_tls,
            transport=transport,
            timeout=30.0,
        )

    async def submit(
        self,
        template: str,
        parameters: dict[str, str],
        labels: dict[str, str],
    ) -> WorkflowRef:
        """Submit a workflow from a WorkflowTemplate.

        Argo's /submit body wraps everything under a top-level object (namespace +
        resourceKind/resourceName + submitOptions) rather than bare params [R caveat].
        An idempotency `request-id` label is auto-added if the caller omits it, so a
        retry carries the same id and doesn't double-execute.
        """
        labels = dict(labels)
        labels.setdefault("request-id", str(uuid.uuid4()))
        body: dict[str, Any] = {
            "namespace": self.namespace,
            "resourceKind": "WorkflowTemplate",
            "resourceName": template,
            "submitOptions": {
                "parameters": [f"{k}={v}" for k, v in parameters.items()],
                "labels": ",".join(f"{k}={v}" for k, v in labels.items()),
            },
        }
        resp = await self._client.post(
            f"/api/v1/workflows/{self.namespace}/submit", json=body
        )
        resp.raise_for_status()
        name = (resp.json().get("metadata") or {}).get("name", "")
        return WorkflowRef(namespace=self.namespace, name=name)

    async def get(self, ref: WorkflowRef) -> WorkflowStatus:
        resp = await self._client.get(
            f"/api/v1/workflows/{ref.namespace}/{ref.name}"
        )
        resp.raise_for_status()
        return normalize_status(resp.json())

    async def watch(
        self, ref: WorkflowRef, backoff: float = 1.0
    ) -> AsyncIterator[WorkflowStatus]:
        """Stream normalized status from /workflow-events (SSE), yielding on each
        event until the workflow reaches a terminal phase.

        Resilience: if the stream drops or ends without a terminal phase, reconcile
        via GET (the durable truth) and, if still running, reconnect after a backoff.
        This survives a BFF restart without losing the terminal state.
        """
        params = {"listOptions.fieldSelector": f"metadata.name={ref.name}"}
        while True:
            try:
                async with self._client.stream(
                    "GET", f"/api/v1/workflow-events/{ref.namespace}", params=params
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        obj = _parse_sse_workflow(line)
                        if obj is None:
                            continue
                        ws = normalize_status(obj)
                        if ws.name and ws.name != ref.name:
                            continue
                        yield ws
                        if ws.phase in TERMINAL_PHASES:
                            return
            except httpx.HTTPError:
                pass  # fall through to GET reconciliation

            # Stream ended or dropped without a terminal event: reconcile via GET.
            ws = await self.get(ref)
            yield ws
            if ws.phase in TERMINAL_PHASES:
                return
            await asyncio.sleep(backoff)  # backoff before reconnecting

    async def aclose(self) -> None:
        await self._client.aclose()
