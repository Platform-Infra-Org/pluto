"""File upload field -> Argo artifact repository (E08 Task 4).

Files are NOT inlined into the resource JSON that lands in Git. The BFF stores
the bytes in the **Argo artifact repository** (S3/MinIO, reused — no separate
bucket) under `uploads/` and returns a **reference** (uri + checksum + filename +
size) for the request payload; the workflow consumes it as an input artifact.
Size (`ARTIFACT_MAX_UPLOAD_MB`) and content type are enforced at the boundary.

The real S3 store uses boto3 (imported lazily) and is DEFERRED — no object store
here. Unit tests inject a fake in-memory store.
"""

from __future__ import annotations

import hashlib
from typing import Protocol

from app.config import settings

# Small text configs and certs — never executables/binaries by default.
DEFAULT_ALLOWED_TYPES: set[str] = {
    "application/json",
    "application/x-yaml",
    "text/yaml",
    "text/plain",
    "application/pdf",
    "application/x-pem-file",
    "application/x-x509-ca-cert",
    "application/pkix-cert",
    "application/zip",
    "application/octet-stream",
}


class UploadTooLarge(Exception):
    """Upload exceeds ARTIFACT_MAX_UPLOAD_MB (API -> 413)."""


class UploadTypeNotAllowed(Exception):
    """Upload content type is not in the allowed set (API -> 415)."""


class ArtifactStore(Protocol):
    def put(self, key: str, data: bytes, content_type: str) -> str:
        """Store bytes at `key`; return the object URI."""
        ...


def store_upload(
    filename: str,
    content: bytes,
    content_type: str,
    *,
    store: ArtifactStore,
    max_mb: int,
    allowed_types: set[str] = DEFAULT_ALLOWED_TYPES,
) -> dict:
    """Validate + store an upload; return its payload reference. Never inlines."""
    if len(content) > max_mb * 1024 * 1024:
        raise UploadTooLarge(f"upload exceeds {max_mb} MB")
    if content_type not in allowed_types:
        raise UploadTypeNotAllowed(f"content type {content_type!r} not allowed")
    digest = hashlib.sha256(content).hexdigest()
    key = f"uploads/{digest}-{filename}"  # content-addressed => natural dedup
    uri = store.put(key, content, content_type)
    return {
        "uri": uri,
        "checksum": f"sha256:{digest}",
        "filename": filename,
        "size": len(content),
    }


class S3ArtifactStore:
    """boto3-backed store for the Argo artifact bucket. DEFERRED (no S3 here)."""

    def __init__(self) -> None:
        import boto3  # lazy: only needed on the live path

        self._bucket = settings.artifact_s3_bucket
        self._s3 = boto3.client(
            "s3",
            endpoint_url=settings.artifact_s3_endpoint or None,
            aws_access_key_id=settings.artifact_s3_access_key or None,
            aws_secret_access_key=settings.artifact_s3_secret_key or None,
        )

    def put(self, key: str, data: bytes, content_type: str) -> str:
        self._s3.put_object(
            Bucket=self._bucket, Key=key, Body=data, ContentType=content_type
        )
        return f"s3://{self._bucket}/{key}"


def default_store() -> ArtifactStore:
    return S3ArtifactStore()
