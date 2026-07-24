"""Block manifest schema + parser/validator + type-assignability (CB01 Task 1).

A block manifest (design 11 §3) is the YAML a platform-admin authors to onboard a
function block: typed inputs/outputs + a `template.ref` naming the Argo
WorkflowTemplate that runs it. We parse it into `BlockManifest`, validating the
type grammar and required fields *before* anything is stored.

Type system (v1, design §3): `string | number | boolean | json | enum[...] |
map<string,T> | jsonpath | secretRef`, with `json` as the permissive top type for
wiring assignability.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import yaml

SCALARS = {"string", "number", "boolean", "json", "jsonpath", "secretRef"}


class ManifestError(ValueError):
    """A manifest failed validation (bad type, missing required field)."""


@dataclass(frozen=True)
class IOType:
    """A parsed IO type. `kind` is one scalar name or 'enum'/'map'."""

    kind: str
    values: tuple[str, ...] = ()  # enum only
    key_type: IOType | None = None  # map only
    value_type: IOType | None = None  # map only

    def __str__(self) -> str:
        if self.kind == "enum":
            return f"enum[{','.join(self.values)}]"
        if self.kind == "map":
            return f"map<{self.key_type},{self.value_type}>"
        return self.kind


def parse_type(spec: str) -> IOType:
    """Parse a type spec string into an `IOType`, raising `ManifestError`."""
    s = spec.strip()
    if s in SCALARS:
        return IOType(kind=s)
    if s.startswith("enum[") and s.endswith("]"):
        values = tuple(v.strip() for v in s[5:-1].split(",") if v.strip())
        if not values:
            raise ManifestError(f"empty enum: {spec!r}")
        return IOType(kind="enum", values=values)
    if s.startswith("map<") and s.endswith(">"):
        inner = s[4:-1]
        key, _, val = inner.partition(",")
        if not val:
            raise ManifestError(f"map needs <key,value>: {spec!r}")
        key_t = parse_type(key)
        if key_t.kind != "string":
            raise ManifestError(f"map key must be string: {spec!r}")
        return IOType(kind="map", key_type=key_t, value_type=parse_type(val))
    raise ManifestError(f"unknown type: {spec!r}")


def is_assignable(src: IOType, dst: IOType) -> bool:
    """Can a value of `src` feed an input typed `dst`? `json` is the top type."""
    if dst.kind == "json":  # anything fits the permissive top type
        return True
    if src.kind == "json":  # ...but json won't narrow into a concrete type
        return False
    if src.kind != dst.kind:
        return False
    if dst.kind == "enum":  # src's values must all be accepted by dst
        return set(src.values) <= set(dst.values)
    if dst.kind == "map":
        assert src.value_type and dst.value_type  # both maps by kind check
        return is_assignable(src.value_type, dst.value_type)
    return True


@dataclass
class IOField:
    name: str
    type: IOType
    required: bool = False


@dataclass
class BlockManifest:
    name: str
    category: str
    template_ref: str  # the Argo WorkflowTemplate that runs this block
    entrypoint: str = "run"  # the template within that WorkflowTemplate (templateRef.template)
    inputs: list[IOField] = field(default_factory=list)
    outputs: list[IOField] = field(default_factory=list)
    icon: str = ""
    ui: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        """JSON-serializable form stored as the `manifest` jsonb + API payload."""

        def io(f: IOField) -> dict:
            return {"name": f.name, "type": str(f.type), "required": f.required}

        return {
            "name": self.name,
            "category": self.category,
            "icon": self.icon,
            "template_ref": self.template_ref,
            "entrypoint": self.entrypoint,
            "inputs": [io(f) for f in self.inputs],
            "outputs": [io(f) for f in self.outputs],
            "ui": self.ui,
        }


def manifest_from_dict(d: dict) -> BlockManifest:
    """Inverse of `BlockManifest.as_dict` — rebuild a manifest from stored/registry
    JSON (type strings back into `IOType`). Used to feed the generator."""

    def io(f: dict) -> IOField:
        return IOField(name=f["name"], type=parse_type(f["type"]), required=bool(f.get("required")))

    return BlockManifest(
        name=d["name"],
        category=d.get("category", ""),
        template_ref=d.get("template_ref", ""),
        entrypoint=d.get("entrypoint") or "run",
        inputs=[io(f) for f in d.get("inputs", [])],
        outputs=[io(f) for f in d.get("outputs", [])],
        icon=d.get("icon", ""),
        ui=d.get("ui") or {},
    )


def _fields(raw: object, where: str) -> list[IOField]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ManifestError(f"{where} must be a list")
    out: list[IOField] = []
    for item in raw:
        if not isinstance(item, dict) or "name" not in item:
            raise ManifestError(f"{where} entry missing 'name': {item!r}")
        if "type" not in item:
            raise ManifestError(f"{where} field {item['name']!r} missing 'type'")
        out.append(
            IOField(
                name=item["name"],
                type=parse_type(str(item["type"])),
                required=bool(item.get("required", False)),
            )
        )
    return out


def parse_manifest(yaml_str: str) -> BlockManifest:
    """Parse + validate a block manifest YAML, raising `ManifestError`."""
    try:
        doc = yaml.safe_load(yaml_str)
    except yaml.YAMLError as exc:
        raise ManifestError(f"invalid YAML: {exc}") from exc
    if not isinstance(doc, dict):
        raise ManifestError("manifest must be a mapping")

    meta = doc.get("metadata") or {}
    name = meta.get("name")
    if not name:
        raise ManifestError("metadata.name is required")

    template = doc.get("template") or {}
    if not isinstance(template, dict):
        template = {}
    template_ref = template.get("ref")
    if not template_ref:
        raise ManifestError("template.ref is required")

    return BlockManifest(
        name=name,
        category=meta.get("category", ""),
        icon=meta.get("icon", ""),
        template_ref=template_ref,
        entrypoint=template.get("entrypoint") or "run",
        inputs=_fields(doc.get("inputs"), "inputs"),
        outputs=_fields(doc.get("outputs"), "outputs"),
        ui=doc.get("ui") or {},
    )
