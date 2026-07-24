"""Save composed graphs -> regenerate (CB02) -> persist (CB04 Task 2).

The single place graph JSON becomes persisted artifacts: parse the posted graph,
validate + regenerate via the *pure* CB02 generator, and store `generated` plus the
block versions each node was wired against (pin-until-migrated / block-drift, §14).
An invalid graph raises `GenerationError` — nothing is persisted (no partial YAML).
The BFF never writes Git; the templates are only persisted for later display.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.blocks import registry
from app.generator.generate import generate
from app.generator.graph import parse_graphs
from app.services.definition import ServiceDefinition


def _json_type(t: str) -> dict:
    """Map a request-field type to a JSON Schema fragment for the request form."""
    if t.startswith("enum[") and t.endswith("]"):
        return {"type": "string", "enum": [v.strip() for v in t[5:-1].split(",") if v.strip()]}
    return {
        "number": {"type": "number"},
        "boolean": {"type": "boolean"},
        "json": {"type": "object"},
    }.get(t, {"type": "string"})


def _form_schema_from_graphs(graphs: dict) -> dict:
    """Derive the request form's JSON Schema from the graph's declared request fields
    (unioned across verbs), so an onboarded type is requestable WITH its fields."""
    fields: dict[str, str] = {}
    for verb in ("create", "update", "delete"):
        fields.update((graphs.get(verb) or {}).get("request_fields") or {})
    props = {name: _json_type(t) for name, t in fields.items()}
    return {"type": "object", "properties": props, "required": list(props)}


def _pinned_versions(graphs: dict, palette: list[dict]) -> dict[str, int]:
    """Pin the current registry version of every block referenced by a node."""
    version_of = {b["name"]: b["version"] for b in palette}
    used: set[str] = set()
    for verb in ("create", "update", "delete"):
        for node in (graphs.get(verb) or {}).get("nodes") or []:
            if isinstance(node, dict) and node.get("block"):
                used.add(node["block"])
    return {name: version_of[name] for name in used if name in version_of}


async def save_graphs(
    session: AsyncSession, defn: ServiceDefinition, graphs: dict
) -> ServiceDefinition:
    """Validate + regenerate + persist. Raises GenerationError on an invalid graph."""
    palette = await registry.list_blocks(session)
    manifests = await registry.load_manifests(session)

    # generate() raises GenerationError on an invalid graph -> nothing persisted
    # (this runs before session.add below, so a fresh/forked defn is never inserted).
    gen = generate(parse_graphs(graphs), manifests)

    session.add(defn)
    defn.graphs = graphs
    # The graph's request fields ARE the request form for this type.
    defn.form_schema = _form_schema_from_graphs(graphs)
    defn.generated = {
        "build_json_j2": gen.build_json_j2,
        "workflow_template_yaml": gen.workflow_template_yaml,
    }
    defn.block_versions = _pinned_versions(graphs, palette)
    await session.commit()
    return defn
