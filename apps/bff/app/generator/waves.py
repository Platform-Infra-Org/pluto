"""Topological wave grouping (design §7 generator algorithm).

Nodes whose inputs are all satisfiable form a wave; a node's wave = 1 + the max
wave of the nodes it depends on. Ordering is deterministic — within a wave,
dependencies before internals, then by id — so golden output is reproducible. The
wave containing `main` is always last (main depends on everything it references).
"""

from __future__ import annotations

from app.generator.graph import Kind, Node, ServiceGraph, node_dep_ids

_KIND_RANK = {Kind.DEPENDENCY: 0, Kind.INTERNAL: 1, Kind.MAIN: 2}


def _order_key(node: Node) -> tuple[int, str]:
    return (_KIND_RANK[node.kind], node.id)


def waves(graph: ServiceGraph) -> list[list[str]]:
    """Group node ids into ordered waves. Assumes a valid DAG (see `validate`)."""
    ids = graph.by_id()
    level: dict[str, int] = {}

    def depth(nid: str, seen: frozenset[str]) -> int:
        if nid in level:
            return level[nid]
        if nid in seen:
            raise ValueError(f"cycle at {nid}")
        deps = [d for d in node_dep_ids(ids[nid]) if d in ids]
        lvl = 0 if not deps else 1 + max(depth(d, seen | {nid}) for d in deps)
        level[nid] = lvl
        return lvl

    for nid in ids:
        depth(nid, frozenset())

    grouped: dict[int, list[Node]] = {}
    for node in graph.nodes:
        grouped.setdefault(level[node.id], []).append(node)
    return [
        [n.id for n in sorted(grouped[lvl], key=_order_key)] for lvl in sorted(grouped)
    ]
