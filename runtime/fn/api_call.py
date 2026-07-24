"""fn-api-call — execute an HTTP call, resolving secretRef headers (design §8).

A header value of the form ``{"secretRef": "NAME"}`` is resolved by NAME from the
injected cluster Secret store (``secret_refs``) **only at call time**, into the
outgoing request. The secret value is never returned in the outputs and never
appears in ``safe_headers()`` (the loggable view keeps the reference marker), so
it cannot leak into logs or downstream workflow parameters.
"""

from __future__ import annotations

from typing import Any

import httpx

SecretRefs = dict[str, str]


def _is_ref(value: Any) -> bool:
    return isinstance(value, dict) and set(value) == {"secretRef"}


def _resolve_headers(headers: dict | None, secret_refs: SecretRefs) -> dict[str, str]:
    """New dict with secretRef values replaced by the secret; caller's dict untouched."""
    out: dict[str, str] = {}
    for key, value in (headers or {}).items():
        if _is_ref(value):
            name = value["secretRef"]
            out[key] = secret_refs[name]  # KeyError → clear "missing secret NAME"
        else:
            out[key] = str(value)
    return out


def safe_headers(headers: dict | None) -> dict[str, str]:
    """Loggable header view: secretRef entries stay as ``<<secret:NAME>>`` markers."""
    out: dict[str, str] = {}
    for key, value in (headers or {}).items():
        out[key] = f"<<secret:{value['secretRef']}>>" if _is_ref(value) else str(value)
    return out


def call(
    method: str,
    url: str,
    body: Any = None,
    headers: dict | None = None,
    secret_refs: SecretRefs | None = None,
    *,
    transport: httpx.BaseTransport | None = None,
    timeout: float = 30.0,
) -> dict:
    """Perform the HTTP call → ``{"status": int, "response": json|text}``.

    ``transport`` is injectable so tests drive it with ``httpx.MockTransport``.
    """
    resolved_headers = _resolve_headers(headers, secret_refs or {})
    with httpx.Client(transport=transport, timeout=timeout) as client:
        resp = client.request(
            method.upper(),
            url,
            json=body if body is not None else None,
            headers=resolved_headers or None,
        )
    try:
        payload: Any = resp.json()
    except ValueError:
        payload = resp.text
    return {"status": resp.status_code, "response": payload}
