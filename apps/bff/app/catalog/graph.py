"""Dependency-subgraph builder for a resource.

Each resource type identifies its instances by a dot-path `id_field` (on the
type's ACTIVE ServiceDefinition, default `metadata.name`). A resource declares
its dependencies by referencing another resource's id value somewhere inside its
`mapping.children` subtree. We index every *visible* resource by id value, then
BFS from the target, following child references, to build a small connected
subgraph (depth-limited). RBAC is inherited from `index.list_resources`.
"""

from __future__ import annotations

from app.auth.principal import Principal
from app.catalog import index
from app.models.resource import ResourceIndex
from app.services.definition import resolve

DEFAULT_ID_FIELD = "metadata.name"
MAX_DEPTH = 3


def _id_value(payload: object, id_field: str) -> str | None:
    """Value at the dot-path, or None if absent / not a string."""
    cur: object = payload
    for part in id_field.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur if isinstance(cur, str) else None


def _scalar_strings(obj: object) -> list[str]:
    """Every string leaf reachable inside a JSON-ish value."""
    if isinstance(obj, dict):
        return [s for v in obj.values() for s in _scalar_strings(v)]
    if isinstance(obj, list):
        return [s for v in obj for s in _scalar_strings(v)]
    return [obj] if isinstance(obj, str) else []


def _children(payload: object) -> object:
    if not isinstance(payload, dict):
        return {}
    mapping = payload.get("mapping")
    return mapping.get("children", {}) if isinstance(mapping, dict) else {}


async def build_graph(
    session, principal: Principal, resource_id: int
) -> dict | None:
    """Return {nodes, edges} for the target's dependency subgraph, or None if the
    target is not visible to the principal. Never raises on odd payload shapes."""
    target = await index.get_resource(session, principal, resource_id)
    if target is None:
        return None

    rows: list[ResourceIndex] = await index.list_resources(
        session, principal, page_size=10000
    )

    # id_field per distinct type (default metadata.name when no ACTIVE definition).
    id_fields: dict[str, str] = {}
    for t in {r.type for r in rows}:
        d = await resolve(session, t)
        id_fields[t] = d.id_field if d and d.id_field else DEFAULT_ID_FIELD

    def idv(r: ResourceIndex) -> str | None:
        return _id_value(r.payload, id_fields.get(r.type, DEFAULT_ID_FIELD))

    by_id: dict[str, ResourceIndex] = {}
    for r in rows:
        v = idv(r)
        if v is not None:
            by_id.setdefault(v, r)  # first wins on the rare id collision

    nodes: dict[int, ResourceIndex] = {target.id: target}
    edges: list[dict] = []
    seen_edges: set[tuple[int, int]] = set()
    visited: set[int] = {target.id}
    frontier: list[tuple[ResourceIndex, int]] = [(target, 0)]

    while frontier:
        row, depth = frontier.pop()
        if depth >= MAX_DEPTH:
            continue
        own = idv(row)
        for s in _scalar_strings(_children(row.payload)):
            dep = by_id.get(s)
            if dep is None or dep.id == row.id or s == own:
                continue
            key = (row.id, dep.id)
            if key not in seen_edges:
                seen_edges.add(key)
                edges.append({"from": row.id, "to": dep.id})
            nodes[dep.id] = dep
            if dep.id not in visited:
                visited.add(dep.id)
                frontier.append((dep, depth + 1))

    return {
        "nodes": [
            {"id": r.id, "name": r.name, "type": r.type, "id_value": idv(r)}
            for r in nodes.values()
        ],
        "edges": edges,
    }
