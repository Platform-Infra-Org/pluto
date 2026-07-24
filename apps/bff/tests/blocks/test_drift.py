"""CB04 Task 4 — block-drift vs the versions a definition was wired against.

Each node pins the block version it was wired against (`block_versions`). When the
registry ships a newer version of a used block, the definition is flagged drifted so
the owner re-validates/re-onboards (mirrors pin-until-migrated, design §14).
"""

import pytest

from app.blocks import drift as drift_mod
from app.blocks.manifest import parse_manifest
from app.blocks.registry import upsert_block
from app.blocks.seed import seed_builtins
from app.services.definition import ServiceDefinition

pytestmark = pytest.mark.anyio


def _defn(block_versions):
    return ServiceDefinition(name="svc", owner_team="t", version=1, block_versions=block_versions)


async def test_no_drift_when_pinned_matches_latest(session):
    await seed_builtins(session)  # api-call v1
    assert await drift_mod.drift(session, _defn({"api-call": 1})) == []


async def test_bumped_block_flags_drift(session):
    await seed_builtins(session)
    d = _defn({"api-call": 1})
    # Platform ships a new api-call version.
    await upsert_block(session, parse_manifest("""
kind: FunctionBlock
metadata: {name: api-call, category: builtin}
template: {ref: fn-api-call}
inputs: [{name: url, type: string, required: true}]
outputs: [{name: response, type: json}]
"""))
    drifts = await drift_mod.drift(session, d)
    assert len(drifts) == 1
    assert drifts[0].block == "api-call" and drifts[0].pinned == 1 and drifts[0].latest == 2


async def test_unpinned_or_missing_block_no_drift(session):
    await seed_builtins(session)
    # A block the definition doesn't use, and a pin for a block not in the registry.
    assert await drift_mod.drift(session, _defn({})) == []
    assert await drift_mod.drift(session, _defn({"ghost": 3})) == []
