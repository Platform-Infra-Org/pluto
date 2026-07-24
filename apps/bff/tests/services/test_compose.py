"""CB04 Task 2 — save graphs -> regenerate (CB02) -> persist + pin block versions.

`save_graphs` validates the posted graph, regenerates the artifacts via the pure
CB02 generator, and stores `generated` + the block versions each node was wired
against. An invalid graph is rejected (GenerationError) and nothing is persisted.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.blocks.model import FunctionBlock  # noqa: F401 — register table
from app.blocks.seed import seed_builtins
from app.config import settings
from app.generator.generate import GenerationError
from app.models.base import Base
from app.services import compose
from app.services.definition import DRAFT, ServiceDefinition

pytestmark = pytest.mark.anyio


@pytest.fixture
async def session():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("TRUNCATE function_block, service_definition RESTART IDENTITY"))
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        await seed_builtins(s)
        yield s
    await engine.dispose()


def _main(**over):
    node = {
        "id": "main",
        "block": "api-call",
        "kind": "main",
        "input_bindings": {"method": "POST", "url": "https://db.api/x",
                           "body": {"name": {"kind": "request", "field": "app_name"}}},
    }
    node.update(over)
    return node


def _graphs(nodes):
    return {"name": "app-database",
            "create": {"request_fields": {"app_name": "string"}, "nodes": nodes}}


async def _draft(session):
    d = ServiceDefinition(name="app-database", owner_team="payments", status=DRAFT, version=1)
    session.add(d)
    await session.commit()
    return d


async def test_valid_graphs_persist_artifacts_and_pinned_versions(session):
    d = await _draft(session)
    graphs = _graphs([_main()])
    out = await compose.save_graphs(session, d, graphs)

    assert out.graphs == graphs
    assert "payload" in out.generated["build_json_j2"]
    assert "WorkflowTemplate" in out.generated["workflow_template_yaml"]
    # api-call was seeded at version 1 -> the node pins it.
    assert out.block_versions == {"api-call": 1}

    reloaded = await session.get(ServiceDefinition, d.id)
    assert reloaded.generated["workflow_template_yaml"] == out.generated["workflow_template_yaml"]


async def test_invalid_graph_rejected_nothing_persisted(session):
    d = await _draft(session)
    two_mains = _graphs([_main(), _main(id="main2")])
    with pytest.raises(GenerationError):
        await compose.save_graphs(session, d, two_mains)

    reloaded = await session.get(ServiceDefinition, d.id)
    assert reloaded.graphs == {}  # untouched
    assert reloaded.generated == {}
