"""Block-drift detection (CB04 Task 4, design §14).

Each node pins the block version it was wired against (`ServiceDefinition.block_versions`).
When the registry's latest version of a used block is newer than the pinned one, the
definition is *drifted*: the owner should re-validate/re-onboard so the change is
reviewed (mirrors pin-until-migrated — a newer block never silently rewires a service).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.blocks import registry
from app.services.definition import ServiceDefinition


@dataclass(frozen=True)
class BlockDrift:
    block: str
    pinned: int
    latest: int


def drift_against(defn: ServiceDefinition, latest: dict[str, int]) -> list[BlockDrift]:
    """Pure: pinned block versions in `defn` vs a precomputed registry-latest map.

    Split out so a list endpoint can compute `latest` once for many definitions.
    """
    return [
        BlockDrift(name, pinned, latest[name])
        for name, pinned in (defn.block_versions or {}).items()
        if name in latest and latest[name] > pinned
    ]


async def drift(session: AsyncSession, defn: ServiceDefinition) -> list[BlockDrift]:
    """Blocks whose registry-latest version is newer than the version pinned in `defn`."""
    latest = {b["name"]: b["version"] for b in await registry.list_blocks(session)}
    return drift_against(defn, latest)
