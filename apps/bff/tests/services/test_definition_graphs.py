"""CB04 Task 1 — ServiceDefinition persists per-verb graphs + generated artifacts.

Extends the E08 definition with `graphs {create?,update?,delete?}`, `generated
{build_json_j2, workflow_template_yaml}` and pinned `block_versions`. Only the
verbs the owner defined are present in `graphs`.
"""

import pytest

from app.services.definition import ServiceDefinition

pytestmark = pytest.mark.anyio


async def test_definition_persists_graphs_generated_and_block_versions(session):
    d = ServiceDefinition(
        name="app-database",
        owner_team="payments",
        graphs={"create": {"nodes": [{"id": "main"}]}},  # only create defined
        generated={"build_json_j2": "{{ payload }}", "workflow_template_yaml": "kind: WorkflowTemplate"},
        block_versions={"api-call": 1},
        version=1,
    )
    session.add(d)
    await session.commit()

    row = await session.get(ServiceDefinition, d.id)
    assert set(row.graphs) == {"create"}  # only defined verbs present
    assert "update" not in row.graphs and "delete" not in row.graphs
    assert row.generated["workflow_template_yaml"] == "kind: WorkflowTemplate"
    assert row.block_versions == {"api-call": 1}


async def test_graphs_default_empty(session):
    d = ServiceDefinition(name="empty", owner_team="t", version=1)
    session.add(d)
    await session.commit()
    row = await session.get(ServiceDefinition, d.id)
    assert row.graphs == {} and row.generated == {} and row.block_versions == {}
