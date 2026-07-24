"""Derive a block manifest for a *service block* from its ServiceDefinition (Task 3).

A dependency service is a block in the graph too (design §2/§3): its inputs are the
request fields it needs (from `form_schema`), and it emits its resource JSON as a
single `result` output that downstream json-extractors curate. `template_ref` is
the service's own WorkflowTemplate — the one object named for the service (§7).
"""

from __future__ import annotations

from app.blocks.manifest import BlockManifest, IOField, IOType, parse_type
from app.services.definition import ServiceDefinition

# JSON Schema primitive type -> block IOType kind.
_JSON_SCHEMA_KIND = {
    "string": "string",
    "integer": "number",
    "number": "number",
    "boolean": "boolean",
}


def _io_type(prop: dict) -> IOType:
    if isinstance(prop.get("enum"), list) and prop["enum"]:
        return IOType(kind="enum", values=tuple(str(v) for v in prop["enum"]))
    kind = _JSON_SCHEMA_KIND.get(prop.get("type", ""))
    if kind is None:  # object/array/untyped -> permissive json
        return parse_type("json")
    return parse_type(kind)


def derive_service_block(defn: ServiceDefinition) -> BlockManifest:
    schema = defn.form_schema or {}
    required = set(schema.get("required") or [])
    inputs = [
        IOField(name=name, type=_io_type(prop or {}), required=name in required)
        for name, prop in (schema.get("properties") or {}).items()
    ]
    return BlockManifest(
        name=defn.name,
        category="service",
        icon="box",
        template_ref=defn.name,  # the generated WorkflowTemplate is named for the service (§7)
        inputs=inputs,
        # E08's ServiceDefinition carries no explicit outputs declaration yet; a
        # dependency emits its resource JSON, curated downstream via json-extractor.
        outputs=[IOField(name="result", type=parse_type("json"))],
    )
