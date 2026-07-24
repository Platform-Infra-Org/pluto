"""generate() — the generator's public entry point (design §10).

Validates every defined verb's graph, then emits the artifacts: one `build-json.j2`
per verb and the single per-service `WorkflowTemplate`. Pure and deterministic; an
invalid graph raises `GenerationError` so no partial output is ever produced.

Recursion namespacing: a dependency service is invoked by `templateRef` and its
outputs are referenced under `mapping.children.<child>.*` (never inlined), so a
child — and, fractally, a grandchild under `mapping.children.<child>.mapping.…` —
can never collide with the parent's own paths.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.blocks.manifest import BlockManifest
from app.generator.argo_gen import emit_workflow_template
from app.generator.graph import Graphs
from app.generator.jinja_gen import emit_jinja
from app.generator.validate import ValidationError, validate


class GenerationError(Exception):
    """A graph was invalid — generation is blocked (no partial output)."""

    def __init__(self, errors: list[ValidationError] | str):
        self.errors = [] if isinstance(errors, str) else errors
        super().__init__(errors if isinstance(errors, str) else "; ".join(str(e) for e in errors))


@dataclass
class Generated:
    build_json_j2: str  # the primary (create, else first) verb's template
    workflow_template_yaml: str
    build_json_by_verb: dict[str, str]


def generate(graphs: Graphs, blocks: dict[str, BlockManifest]) -> Generated:
    defined = graphs.defined()
    if not defined:
        raise GenerationError("service must define at least one verb")

    errors: list[ValidationError] = []
    for _verb, graph in defined:
        errors += validate(graph, blocks)
    if errors:
        raise GenerationError(errors)

    by_verb = {verb: emit_jinja(graph) for verb, graph in defined}
    primary = by_verb.get("create") or next(iter(by_verb.values()))
    yaml = emit_workflow_template(graphs.name, defined)
    return Generated(build_json_j2=primary, workflow_template_yaml=yaml, build_json_by_verb=by_verb)
