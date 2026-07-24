"""Service-graph model — the pure input the generator compiles (design 11 §4).

A service owner composes one DAG of nodes per verb they support. Each node is an
instance of a block (function block or dependency service) with literal config and
per-input *bindings*. Edges are implied by output references; the generator
topologically orders them. This module is data only — no I/O, no validation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from app.blocks.manifest import IOType


class Kind(str, Enum):
    """A node's role in the runtime big-JSON (design §4/§5)."""

    MAIN = "main"  # produces `payload` — the primary api-call (exactly one)
    DEPENDENCY = "dependency"  # a service block -> mapping.children
    INTERNAL = "internal"  # a side function node -> mapping.internals


@dataclass(frozen=True)
class Ref:
    """Bind to a request field: ``request.<field>`` (known at render #0)."""

    field: str


@dataclass(frozen=True)
class OutRef:
    """Bind to another node's declared output (an implied edge)."""

    node: str
    output: str


@dataclass(frozen=True)
class Lit:
    """A literal value baked into the template."""

    value: object


Binding = Ref | OutRef | Lit


@dataclass
class Node:
    id: str
    block: str  # function-block name OR dependency service name
    kind: Kind
    action: str | None = None  # for dependency nodes: create | update | delete
    config: dict = field(default_factory=dict)  # literal config (method, url, rules, body)
    input_bindings: dict[str, Binding] = field(default_factory=dict)
    outputs: list[str] = field(default_factory=list)


@dataclass
class ServiceGraph:
    """One verb's DAG plus the service's request-field types (for validation)."""

    nodes: list[Node]
    request_fields: dict[str, IOType] = field(default_factory=dict)

    def by_id(self) -> dict[str, Node]:
        return {n.id: n for n in self.nodes}

    def mains(self) -> list[Node]:
        return [n for n in self.nodes if n.kind is Kind.MAIN]

    @property
    def main(self) -> Node:
        return self.mains()[0]


@dataclass
class Graphs:
    """A service's per-verb graphs — only the verbs the owner defined are present."""

    name: str
    create: ServiceGraph | None = None
    update: ServiceGraph | None = None
    delete: ServiceGraph | None = None

    def defined(self) -> list[tuple[str, ServiceGraph]]:
        """(verb, graph) for each defined verb, in create/update/delete order."""
        pairs = [("create", self.create), ("update", self.update), ("delete", self.delete)]
        return [(v, g) for v, g in pairs if g is not None]


def node_dep_ids(node: Node) -> set[str]:
    """The node ids this node depends on (via OutRef bindings + main body refs)."""
    deps = {b.node for b in node.input_bindings.values() if isinstance(b, OutRef)}
    if node.kind is Kind.MAIN:
        for b in node.config.get("body", {}).values():
            if isinstance(b, OutRef):
                deps.add(b.node)
    return deps


def path_key(node_id: str) -> str:
    """Node id -> big-JSON path segment (Argo params/paths use underscores)."""
    return node_id.replace("-", "_")


def out_path(graph: ServiceGraph, ref: OutRef) -> str:
    """The big-JSON placeholder path an output reference resolves to.

    A json-extractor is *folded* into the internal api-call it reads from (design
    §5): its outputs are namespaced under that api-call's path, not its own.
    """
    node = graph.by_id()[ref.node]
    if node.kind is Kind.DEPENDENCY:
        return f"mapping.children.{path_key(node.id)}.outputs.{ref.output}"
    if node.block == "json-extractor":
        src = node.input_bindings["source"]
        assert isinstance(src, OutRef)
        return f"mapping.internals.{path_key(src.node)}.outputs.{ref.output}"
    return f"mapping.internals.{path_key(node.id)}.outputs.{ref.output}"
