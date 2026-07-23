"""Resource catalog API: RBAC-filtered browse + Git webhook.

The app is read-only against Git. The webhook only *triggers* a re-index.
"""

import hashlib
import hmac

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status

from app.catalog.git_sync import sync_repo
from app.config import settings

router = APIRouter()


def _valid_signature(body: bytes, signature: str | None) -> bool:
    secret = settings.git_webhook_secret
    if not secret or not signature:
        return False
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/api/git/webhook", status_code=status.HTTP_202_ACCEPTED)
async def git_webhook(
    request: Request,
    background: BackgroundTasks,
    x_hub_signature_256: str | None = Header(default=None),
) -> dict:
    body = await request.body()
    if not _valid_signature(body, x_hub_signature_256):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid webhook signature")
    background.add_task(sync_repo)
    return {"status": "accepted"}
