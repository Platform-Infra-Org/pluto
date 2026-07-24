"""Server-backed form fields API (E08): groups picker, upload, dynamic options.

Every field's data is served by the BFF, never fetched by the browser from the
underlying system (Keycloak / object store / external API).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.auth.deps import current_principal
from app.auth.principal import Principal
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.services.fields import groups, upload
from app.services.fields.option_source import OptionSource

router = APIRouter(prefix="/api/fields")

# Indirection so tests can swap the Keycloak admin client / artifact store.
_kc_client_factory = groups.admin_client
_store_factory = upload.default_store


@router.get("/groups")
async def groups_field(
    scope: str | None = None,
    principal: Principal = Depends(current_principal),
) -> dict:
    """Scoped Keycloak groups. `mine` needs no directory call; `prefix:<x>` does."""
    client = None
    try:
        if scope and scope.startswith("prefix:"):  # only prefix scopes hit Keycloak
            client = await _kc_client_factory()
        items = await groups.list_groups(
            scope, requester_groups=principal.groups, client=client
        )
    except groups.ScopeRequired as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    finally:
        if client is not None:
            await client.aclose()
    return {"items": items}


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_field(
    request: Request,
    filename: str,
    _: Principal = Depends(current_principal),
) -> dict:
    """Store an uploaded file in the artifact repo; return only its reference.

    Raw-body upload (Content-Type header = the file's type) so we need no
    multipart dependency. Enforces size + allowed types at the boundary.
    """
    content = await request.body()
    content_type = request.headers.get("content-type", "application/octet-stream")
    try:
        return upload.store_upload(
            filename,
            content,
            content_type,
            store=_store_factory(),
            max_mb=settings.artifact_max_upload_mb,
        )
    except upload.UploadTooLarge as exc:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, str(exc)
        ) from exc
    except upload.UploadTypeNotAllowed as exc:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)
        ) from exc


@router.get("/options/{source_id}")
async def options_field(
    source_id: int,
    _: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Serve a dynamic-choice field's options from the cache (never live)."""
    src = await session.get(OptionSource, source_id)
    if src is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "option source not found")
    return {
        "items": src.cached_options,
        "status": src.last_status,  # 'stale' surfaces a flaky upstream to admins
        "last_synced_at": src.last_synced_at.isoformat() if src.last_synced_at else None,
    }
