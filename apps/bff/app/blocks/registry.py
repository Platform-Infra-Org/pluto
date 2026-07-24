"""Function-block registry: list/get/upsert + type-compatibility (CB01 Task 4).

`list_blocks` returns the palette a composer wires from: the latest version of each
onboarded function block, plus a derived manifest for every ACTIVE service (a
dependency = a service block, design §2/§3). Writes validate the manifest first.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.blocks.manifest import BlockManifest, is_assignable
from app.blocks.model import FunctionBlock
from app.blocks.service_block import derive_service_block
from app.services.definition import ACTIVE, ServiceDefinition

# Re-exported: the type-compatibility check the graph editor/generator wire against.
__all__ = ["is_assignable", "list_blocks", "get_block", "upsert_block"]


async def upsert_block(
    session: AsyncSession, manifest: BlockManifest, created_by: str = ""
) -> FunctionBlock:
    """Store a validated manifest as a new version row (pin-until-migrated)."""
    cur = await session.scalar(
        select(func.max(FunctionBlock.version)).where(FunctionBlock.name == manifest.name)
    )
    block = FunctionBlock(
        name=manifest.name,
        version=(cur or 0) + 1,
        category=manifest.category,
        template_ref=manifest.template_ref,
        manifest=manifest.as_dict(),
        created_by=created_by,
    )
    session.add(block)
    await session.commit()
    return block


async def _latest_function_blocks(session: AsyncSession) -> list[dict]:
    rows = list((await session.scalars(select(FunctionBlock))).all())
    latest: dict[str, FunctionBlock] = {}
    for r in rows:
        if r.name not in latest or r.version > latest[r.name].version:
            latest[r.name] = r
    return [
        {"name": r.name, "version": r.version, "kind": "function", "manifest": r.manifest}
        for r in latest.values()
    ]


async def _active_service_blocks(session: AsyncSession) -> list[dict]:
    defns = list(
        (
            await session.scalars(
                select(ServiceDefinition).where(ServiceDefinition.status == ACTIVE)
            )
        ).all()
    )
    return [
        {
            "name": d.name,
            "version": d.version,
            "kind": "service",
            "manifest": derive_service_block(d).as_dict(),
        }
        for d in defns
    ]


async def list_blocks(session: AsyncSession) -> list[dict]:
    """The full palette: latest function blocks + ACTIVE service blocks."""
    return await _latest_function_blocks(session) + await _active_service_blocks(session)


async def get_block(session: AsyncSession, name: str) -> dict | None:
    """A single block by name — function block (latest) or ACTIVE service block."""
    for b in await list_blocks(session):
        if b["name"] == name:
            return b
    return None
