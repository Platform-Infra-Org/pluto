import hashlib
import hmac

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

SECRET = "whsecret"


def _sig(body: bytes) -> str:
    return "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()


@pytest.fixture
def calls(monkeypatch):
    monkeypatch.setattr(settings, "git_webhook_secret", SECRET)
    recorded = []

    async def fake_sync():
        recorded.append(True)
        from app.catalog.git_sync import SyncReport

        return SyncReport()

    import app.api.catalog as cat

    monkeypatch.setattr(cat, "sync_repo", fake_sync)
    return recorded


def test_bad_signature_rejected(calls):
    client = TestClient(app)
    body = b'{"ref":"refs/heads/main"}'
    r = client.post("/api/git/webhook", content=body, headers={"X-Hub-Signature-256": "sha256=bad"})
    assert r.status_code == 401
    assert calls == []


def test_good_signature_triggers_sync(calls):
    client = TestClient(app)
    body = b'{"ref":"refs/heads/main"}'
    r = client.post("/api/git/webhook", content=body, headers={"X-Hub-Signature-256": _sig(body)})
    assert r.status_code == 202
    assert calls == [True]
