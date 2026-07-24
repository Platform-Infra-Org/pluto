"""Blocks API (CB01 Task 4).

`GET /api/blocks` and `GET /api/blocks/{name}` are open to any authed composer.
`POST`/`PUT /api/blocks` upsert a function block from manifest YAML and are
**platform-admin only** (authz enforced server-side). Manifests are validated
before store; an invalid manifest is a 422.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import current_principal, require_role
from app.auth.principal import Principal
from app.blocks import registry
from app.blocks.manifest import ManifestError, manifest_from_dict, parse_manifest
from app.db import get_session

router = APIRouter(prefix="/api/blocks")


class BlockBody(BaseModel):
    manifest: str | None = None  # block manifest YAML (raw authoring form)
    manifest_json: dict | None = None  # structured manifest (from the "new block" form)


def _dump(b) -> dict:
    return {
        "name": b.name,
        "version": b.version,
        "kind": "function",
        "category": b.category,
        "template_ref": b.template_ref,
        "entrypoint": (b.manifest or {}).get("entrypoint", "run"),
        "manifest": b.manifest,
        "created_by": b.created_by,
    }


async def _upsert(body: BlockBody, principal: Principal, session: AsyncSession) -> dict:
    try:
        if body.manifest_json is not None:
            manifest = manifest_from_dict(body.manifest_json)
            if not manifest.name.strip() or not manifest.template_ref.strip():
                raise ManifestError("name and template_ref are required")
        elif body.manifest:
            manifest = parse_manifest(body.manifest)
        else:
            raise ManifestError("provide either `manifest` (YAML) or `manifest_json`")
    except (ManifestError, KeyError, ValueError, TypeError) as exc:
        raise HTTPException(422, str(exc)) from exc
    block = await registry.upsert_block(session, manifest, created_by=principal.sub)
    return _dump(block)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_block(
    body: BlockBody,
    principal: Principal = Depends(require_role("platform-admin")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await _upsert(body, principal, session)


@router.put("", status_code=status.HTTP_201_CREATED)
async def update_block(
    body: BlockBody,
    principal: Principal = Depends(require_role("platform-admin")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await _upsert(body, principal, session)


@router.get("")
async def list_blocks(
    _: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return {"items": await registry.list_blocks(session)}


@router.get("/{name}")
async def get_block(
    name: str,
    _: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    block = await registry.get_block(session, name)
    if block is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "block not found")
    return block
