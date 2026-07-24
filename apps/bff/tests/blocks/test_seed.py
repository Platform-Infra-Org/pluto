"""Seed the v1 built-in function blocks; idempotent (CB01 Task 5)."""

import pytest
from sqlalchemy import func, select

from app.blocks.model import FunctionBlock
from app.blocks.registry import list_blocks
from app.blocks.seed import BUILTINS, seed_builtins

pytestmark = pytest.mark.anyio

EXPECTED = {"api-call", "json-extractor", "set-value", "git-commit", "jinja-render"}


async def test_seed_inserts_all_builtins_with_typed_io(session):
    await seed_builtins(session)
    blocks = {b["name"]: b for b in await list_blocks(session)}
    assert EXPECTED <= set(blocks)

    # Spot-check typed IO faithful to design §3/§8.
    api = blocks["api-call"]["manifest"]
    assert api["template_ref"] == "fn-api-call"
    method = next(i for i in api["inputs"] if i["name"] == "method")
    assert method["type"] == "enum[GET,POST,PUT,DELETE]" and method["required"] is True
    assert {o["name"] for o in api["outputs"]} == {"status", "response"}

    rules = next(i for i in blocks["json-extractor"]["manifest"]["inputs"] if i["name"] == "rules")
    assert rules["type"] == "map<string,jsonpath>"

    jr = blocks["jinja-render"]["manifest"]
    assert {i["name"] for i in jr["inputs"]} == {"template", "request", "resolved"}
    assert {o["name"] for o in jr["outputs"]} == {"payload", "mapping"}

    gc = {i["name"] for i in blocks["git-commit"]["manifest"]["inputs"]}
    assert gc == {"repo", "path", "content"}
    assert blocks["git-commit"]["manifest"]["outputs"][0]["name"] == "sha"

    sv = {i["name"] for i in blocks["set-value"]["manifest"]["inputs"]}
    assert sv == {"expr", "args"}


async def test_seed_is_idempotent(session):
    await seed_builtins(session)
    await seed_builtins(session)
    count = await session.scalar(select(func.count()).select_from(FunctionBlock))
    assert count == len(BUILTINS) == 5
