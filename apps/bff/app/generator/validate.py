"""Graph validation (design §11) — an invalid graph blocks generation entirely.

Checks: exactly one `main`; referenced block/service exists; every required input
bound; type-compatible wires (via CB01 `is_assignable`); the graph is a DAG. Pure:
returns a list of errors (empty == valid); `generate()` raises if non-empty so no
partial output is ever produced.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.blocks.manifest import BlockManifest, IOType, is_assignable
from app.generator.graph import (
    Node,
    OutRef,
    Ref,
    ServiceGraph,
    node_dep_ids,
)


@dataclass
class ValidationError:
    message: str
    node: str | None = None

    def __str__(self) -> str:
        return f"[{self.node}] {self.message}" if self.node else self.message


def validate(graph: ServiceGraph, blocks: dict[str, BlockManifest]) -> list[ValidationError]:
    errs: list[ValidationError] = []

    mains = graph.mains()
    if len(mains) != 1:
        errs.append(ValidationError(f"exactly one `main` node required (found {len(mains)})"))

    ids = graph.by_id()
    for node in graph.nodes:
        manifest = blocks.get(node.block)
        if manifest is None:
            errs.append(ValidationError(f"unknown block/service {node.block!r}", node.id))
            continue
        _check_required(node, manifest, errs)
        _check_types(graph, node, manifest, blocks, ids, errs)

    _check_refs(graph, errs)
    _check_acyclic(graph, errs)
    return errs


def _check_refs(graph: ServiceGraph, errs: list[ValidationError]) -> None:
    """Every OutRef (input bindings + main body) must target a real node — else a
    dangling/typo'd wire slips past validation and KeyErrors at emit time."""
    ids = {n.id for n in graph.nodes}
    for node in graph.nodes:
        for dep in node_dep_ids(node):
            if dep not in ids:
                errs.append(ValidationError(f"binds to unknown node {dep!r}", node.id))


def _check_required(node: Node, manifest: BlockManifest, errs: list[ValidationError]) -> None:
    for inp in manifest.inputs:
        if not inp.required:
            continue
        # Unified model: a required input is satisfied when it has a binding under
        # input_bindings (a map-shaped input counts as bound even when its map is empty).
        if inp.name not in node.input_bindings:
            errs.append(ValidationError(f"required input {inp.name!r} is unbound", node.id))


def _input_type(manifest: BlockManifest, name: str) -> IOType | None:
    for inp in manifest.inputs:
        if inp.name == name:
            return inp.type
    return None


def _output_type(manifest: BlockManifest, name: str) -> IOType | None:
    for out in manifest.outputs:
        if out.name == name:
            return out.type
    return None


def _check_types(
    graph: ServiceGraph,
    node: Node,
    manifest: BlockManifest,
    blocks: dict[str, BlockManifest],
    ids: dict[str, Node],
    errs: list[ValidationError],
) -> None:
    for name, binding in node.input_bindings.items():
        if isinstance(binding, dict):  # map-shaped input (body/rules) — permissive, skip
            continue
        dst = _input_type(manifest, name)
        if dst is None:  # not a declared input -> nothing to type-check
            continue
        if isinstance(binding, Ref):
            src = graph.request_fields.get(binding.field)
        elif isinstance(binding, OutRef):
            src_node = ids.get(binding.node)
            src_manifest = blocks.get(src_node.block) if src_node else None
            src = _output_type(src_manifest, binding.output) if src_manifest else None
        else:
            src = None  # literal — skip
        if src is not None and not is_assignable(src, dst):
            errs.append(
                ValidationError(f"input {name!r} expects {dst} but got {src}", node.id)
            )


def _check_acyclic(graph: ServiceGraph, errs: list[ValidationError]) -> None:
    ids = graph.by_id()
    color: dict[str, int] = {}  # 0=visiting, 1=done

    def visit(nid: str) -> bool:
        if color.get(nid) == 1:
            return False
        if color.get(nid) == 0:
            return True  # back-edge -> cycle
        color[nid] = 0
        for dep in node_dep_ids(ids[nid]):
            if dep in ids and visit(dep):
                return True
        color[nid] = 1
        return False

    for node in graph.nodes:
        if color.get(node.id) is None and visit(node.id):
            errs.append(ValidationError(f"graph has a cycle (at {node.id})", node.id))
            return
