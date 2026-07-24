"""File upload field -> Argo artifact repo (Task 4).

The payload never carries the file, only a reference (uri + checksum + filename +
size). Size + type are enforced. A fake in-memory store stands in for S3/MinIO;
the real boto3-backed store is DEFERRED (no object store here).
"""

import hashlib

import pytest

from app.services.fields import upload
from app.services.fields.upload import (
    UploadTooLarge,
    UploadTypeNotAllowed,
    store_upload,
)

pytestmark = pytest.mark.anyio


class FakeStore:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def put(self, key: str, data: bytes, content_type: str) -> str:
        self.objects[key] = data
        return f"s3://argo-artifacts/{key}"


def test_valid_file_returns_reference_and_stores_bytes():
    store = FakeStore()
    content = b'{"ca": "cert"}'
    ref = store_upload(
        "bundle.json", content, "application/json", store=store, max_mb=10
    )
    digest = hashlib.sha256(content).hexdigest()
    assert ref == {
        "uri": f"s3://argo-artifacts/uploads/{digest}-bundle.json",
        "checksum": f"sha256:{digest}",
        "filename": "bundle.json",
        "size": len(content),
    }
    # File landed in object storage, not in the returned payload.
    assert store.objects[f"uploads/{digest}-bundle.json"] == content


def test_oversize_is_rejected():
    store = FakeStore()
    big = b"x" * (2 * 1024 * 1024)
    with pytest.raises(UploadTooLarge):
        store_upload("big.bin", big, "application/octet-stream", store=store, max_mb=1)
    assert store.objects == {}  # never stored


def test_blocked_type_is_rejected():
    store = FakeStore()
    with pytest.raises(UploadTypeNotAllowed):
        store_upload(
            "evil.exe",
            b"MZ",
            "application/x-dosexec",
            store=store,
            max_mb=10,
            allowed_types={"application/json"},
        )
    assert store.objects == {}


async def test_upload_endpoint_stores_and_returns_reference(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    from app.api import fields as fields_api
    from app.auth.deps import current_principal
    from app.auth.principal import Principal
    from app.main import app

    store = FakeStore()
    monkeypatch.setattr(fields_api, "_store_factory", lambda: store)
    app.dependency_overrides[current_principal] = lambda: Principal(
        sub="u", username="u", groups=[], roles=set(), teams=set()
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/api/fields/upload?filename=bundle.json",
            content=b'{"a":1}',
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 201
        assert r.json()["filename"] == "bundle.json"
        assert r.json()["checksum"].startswith("sha256:")
        # Blocked type -> 4xx, nothing stored.
        r = await c.post(
            "/api/fields/upload?filename=x.exe",
            content=b"MZ",
            headers={"Content-Type": "application/x-dosexec"},
        )
        assert 400 <= r.status_code < 500
    app.dependency_overrides.clear()
    assert len(store.objects) == 1  # only the valid upload persisted


def test_default_allowed_types_cover_configs_not_binaries():
    assert "application/json" in upload.DEFAULT_ALLOWED_TYPES
    assert "application/x-dosexec" not in upload.DEFAULT_ALLOWED_TYPES
