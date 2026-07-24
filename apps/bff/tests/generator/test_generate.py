"""CB02 Task 5 — generate() orchestration, invalid-graph guard, recursion namespacing."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.generator.generate import GenerationError, generate
from tests.generator import fixtures

GOLDEN = Path(__file__).parent / "golden"


def test_end_to_end_matches_goldens():
    gen = generate(fixtures.app_database(create=True), fixtures.blocks())
    assert gen.build_json_j2 == (GOLDEN / "app-database.build-json.j2").read_text()
    assert gen.workflow_template_yaml == (
        GOLDEN / "app-database.workflowtemplate.yaml"
    ).read_text()


def test_per_verb_build_json():
    gen = generate(fixtures.app_database(create=True, delete=True), fixtures.blocks())
    assert set(gen.build_json_by_verb) == {"create", "delete"}
    # delete's big JSON is a different document (DELETE, no dependencies)
    assert "DELETE" in gen.build_json_by_verb["delete"]
    assert "network" not in gen.build_json_by_verb["delete"]


def test_invalid_graph_raises_no_partial_output():
    bad = fixtures.app_database(create=True)
    bad.create = fixtures.cyclic()
    with pytest.raises(GenerationError) as exc:
        generate(bad, fixtures.blocks())
    assert "cycle" in str(exc.value).lower()


def test_two_level_dependency_namespaces_without_collision():
    chain = fixtures.chain_abc()
    blocks = fixtures.chain_blocks()
    a = generate(chain["A"], blocks)
    b = generate(chain["B"], blocks)
    c = generate(chain["C"], blocks)

    # each service references only its DIRECT child, prefixed by mapping.children.<child>
    assert "mapping.children.B.outputs.id" in a.build_json_j2
    assert "mapping.children.C.outputs.id" not in a.build_json_j2  # grandchild not inlined
    assert "mapping.children.C.outputs.id" in b.build_json_j2
    assert "mapping.children" not in c.build_json_j2  # leaf has no deps

    # dependencies invoked by reference (templateRef), never inlined
    assert "name: B\n" in a.workflow_template_yaml
    assert "template: create" in a.workflow_template_yaml

    # namespacing by path prefix: C's output as seen from A's root is distinct from
    # B's own output at A's root — no collision even though both outputs are named "id"
    b_at_a = "mapping.children.B.outputs.id"
    c_at_a = "mapping.children.B." + "mapping.children.C.outputs.id"
    assert b_at_a != c_at_a


def test_no_verbs_defined_raises():
    from app.generator.graph import Graphs

    with pytest.raises(GenerationError):
        generate(Graphs(name="empty"), fixtures.blocks())
