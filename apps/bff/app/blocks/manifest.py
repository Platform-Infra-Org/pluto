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
    template_ref: str
    inputs: list[IOField] = field(default_factory=list)
    outputs: list[IOField] = field(default_factory=list)
    icon: str = ""
    ui: dict = field(default_factory=dict)


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
    template_ref = template.get("ref") if isinstance(template, dict) else None
    if not template_ref:
        raise ManifestError("template.ref is required")

    return BlockManifest(
        name=name,
        category=meta.get("category", ""),
        icon=meta.get("icon", ""),
        template_ref=template_ref,
        inputs=_fields(doc.get("inputs"), "inputs"),
        outputs=_fields(doc.get("outputs"), "outputs"),
        ui=doc.get("ui") or {},
    )
