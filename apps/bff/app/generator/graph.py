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
# An input's stored value: a scalar `Binding`, or a map-shaped input (api-call
# `body`, json-extractor `rules`) as `{key: Binding}`. Unified model — every input
# lives under `Node.input_bindings`; there is no separate literal `config`.
InputValue = Binding | dict[str, Binding]


@dataclass
class Node:
    id: str
    block: str  # function-block name OR dependency service name
    kind: Kind
    action: str | None = None  # for dependency nodes: create | update | delete
    input_bindings: dict[str, InputValue] = field(default_factory=dict)
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


def parse_binding(v: object) -> Binding:
    """Deserialize one tagged binding from graph JSON (CB03 wire shape).

    ``{"kind":"request","field":..}`` / ``{"kind":"output","node":..,"output":..}``
    / ``{"kind":"literal","value":..}``. Anything untagged is treated as a literal.
    """
    if isinstance(v, dict) and v.get("kind") == "request":
        return Ref(v["field"])
    if isinstance(v, dict) and v.get("kind") == "output":
        return OutRef(v["node"], v["output"])
    if isinstance(v, dict) and v.get("kind") == "literal":
        return Lit(v["value"])
    return Lit(v)


_BINDING_KINDS = {"request", "output", "literal"}


def parse_input(v: object) -> InputValue:
    """Deserialize one input value: a tagged scalar `Binding`, or a map-shaped input
    (``body``/``rules``) — a dict of arbitrary keys whose values are bindings.

    A scalar binding is a dict tagged with ``kind`` in {request,output,literal}; any
    other dict is a map<key,Binding>. ponytail: a literal whose *value* is a plain
    dict must be written tagged (``{"kind":"literal","value":{...}}``) to avoid being
    read as a map — the only inputs stored as bare dicts are body/rules.
    """
    if isinstance(v, dict) and v.get("kind") in _BINDING_KINDS:
        return parse_binding(v)
    if isinstance(v, dict):
        return {k: parse_binding(vv) for k, vv in v.items()}
    return parse_binding(v)


def _parse_node(d: dict) -> Node:
    return Node(
        id=d["id"],
        block=d["block"],
        kind=Kind(d["kind"]),
        action=d.get("action"),
        input_bindings={k: parse_input(v) for k, v in (d.get("input_bindings") or {}).items()},
        outputs=list(d.get("outputs") or []),
    )


def _parse_service_graph(d: dict) -> ServiceGraph:
    from app.blocks.manifest import parse_type

    return ServiceGraph(
        nodes=[_parse_node(n) for n in d.get("nodes") or []],
        request_fields={k: parse_type(t) for k, t in (d.get("request_fields") or {}).items()},
    )


def parse_graphs(d: dict) -> Graphs:
    """Deserialize the graph JSON the editor POSTs into the generator's `Graphs`."""
    verbs = {v: _parse_service_graph(d[v]) for v in ("create", "update", "delete") if d.get(v)}
    return Graphs(name=d.get("name", ""), **verbs)


def out_refs(value: InputValue) -> list[OutRef]:
    """Every OutRef inside one input value — the value itself if scalar, or all its
    entries if map-shaped (body/rules)."""
    if isinstance(value, OutRef):
        return [value]
    if isinstance(value, dict):
        return [b for b in value.values() if isinstance(b, OutRef)]
    return []


def node_dep_ids(node: Node) -> set[str]:
    """The node ids this node depends on — every OutRef across all input bindings
    (scalars and map-shaped body/rules values alike)."""
    return {r.node for v in node.input_bindings.values() for r in out_refs(v)}


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
