"""Resource catalog API: RBAC-filtered browse + Git webhook.

The app is read-only against Git. The webhook only *triggers* a re-index.
"""

import hashlib
import hmac

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from fastapi.responses import PlainTextResponse
from git import Repo
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.catalog import graph, index
from app.catalog.git_sync import sync_repo
from app.config import settings
from app.db import get_session
from app.models.resource import ResourceIndex

router = APIRouter()


def _summary(r: ResourceIndex) -> dict:
    return {
        "id": r.id,
        "type": r.type,
        "name": r.name,
        "owner_team": r.owner_team,
        "git_path": r.git_path,
        "git_sha": r.git_sha,
        "status": r.status,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.get("/api/resources")
async def list_resources(
    type: str | None = None,
    q: str | None = None,
    page: int = 1,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    rows = await index.list_resources(session, principal, type=type, q=q, page=page)
    return {"items": [_summary(r) for r in rows], "page": page}


async def _require_resource(
    resource_id: int, principal: Principal, session: AsyncSession
) -> ResourceIndex:
    row = await index.get_resource(session, principal, resource_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "resource not found")
    return row


@router.get("/api/resources/{resource_id}")
async def resource_detail(
    resource_id: int,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    row = await _require_resource(resource_id, principal, session)
    return {**_summary(row), "payload": row.payload}


@router.get("/api/resources/{resource_id}/graph")
async def resource_graph(
    resource_id: int,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    g = await graph.build_graph(session, principal, resource_id)
    if g is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "resource not found")
    return g


@router.get("/api/resources/{resource_id}/raw", response_class=PlainTextResponse)
async def resource_raw(
    resource_id: int,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> str:
    row = await _require_resource(resource_id, principal, session)
    repo = Repo(settings.git_cache_dir)
    return repo.git.show(f"{row.git_sha}:{row.git_path}")


@router.get("/api/resources/{resource_id}/history")
async def resource_history(
    resource_id: int,
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    row = await _require_resource(resource_id, principal, session)
    repo = Repo(settings.git_cache_dir)
    return [
        {
            "sha": c.hexsha,
            "author": c.author.name,
            "date": c.committed_datetime.isoformat(),
            "message": c.message.strip(),
        }
        for c in repo.iter_commits(paths=row.git_path, max_count=50)
    ]


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
