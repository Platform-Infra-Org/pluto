"""fn-api-call — HTTP call + secretRef resolution (design §8).

Secrets are resolved by NAME from a cluster Secret store (injected/mocked here),
only into the outgoing request at call time; they are never echoed into the
returned outputs nor into anything loggable.
"""

from __future__ import annotations

import json

import httpx
import pytest

from fn.api_call import call, safe_headers

SECRET_VALUE = "super-secret-token-abc123"
# Injected/mocked cluster Secret store (name -> value).
SECRETS = {"db-api-token": SECRET_VALUE}


def _transport(captured: dict) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        captured["body"] = request.content.decode() or None
        return httpx.Response(201, json={"id": "db-1", "ok": True})

    return httpx.MockTransport(handler)


def test_request_shape_and_response() -> None:
    captured: dict = {}
    out = call(
        "POST",
        "https://db.api/databases",
        body={"name": "app-42"},
        headers={"X-Env": "prod"},
        secret_refs=SECRETS,
        transport=_transport(captured),
    )
    assert captured["method"] == "POST"
    assert captured["url"] == "https://db.api/databases"
    assert json.loads(captured["body"]) == {"name": "app-42"}
    assert captured["headers"]["x-env"] == "prod"
    assert out == {"status": 201, "response": {"id": "db-1", "ok": True}}


def test_secretref_resolves_into_request_only() -> None:
    captured: dict = {}
    headers = {"Authorization": {"secretRef": "db-api-token"}}
    out = call(
        "GET",
        "https://db.api/x",
        headers=headers,
        secret_refs=SECRETS,
        transport=_transport(captured),
    )
    # resolved into the actual outgoing request
    assert captured["headers"]["authorization"] == SECRET_VALUE

    # NEVER echoed into the returned outputs
    assert SECRET_VALUE not in json.dumps(out)

    # NEVER present in a loggable view of the headers (kept as a reference marker)
    logged = json.dumps(safe_headers(headers))
    assert SECRET_VALUE not in logged
    assert "db-api-token" in logged

    # the caller's headers dict was not mutated to hold the secret
    assert headers["Authorization"] == {"secretRef": "db-api-token"}


def test_missing_secret_raises_clearly() -> None:
    with pytest.raises(KeyError, match="nope"):
        call(
            "GET",
            "https://db.api/x",
            headers={"Authorization": {"secretRef": "nope"}},
            secret_refs=SECRETS,
            transport=_transport({}),
        )


def test_non_json_response_returned_as_text() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="pong")

    out = call("GET", "https://x/ping", transport=httpx.MockTransport(handler))
    assert out == {"status": 200, "response": "pong"}


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
