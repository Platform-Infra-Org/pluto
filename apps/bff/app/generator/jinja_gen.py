"""Emit `build-json.j2` — the per-service Jinja template (design §6).

Renders the runtime *big JSON* (`payload` + `mapping.{children,internals}`). Known-
now values (request fields) are baked as `{{ request.x | tojson }}`; values known
only after a dependency/internal runs use the `ph(path)` macro, which emits a
`"<<path>>"` placeholder until `path` appears in `resolved`, then substitutes it.

The output is deterministic (stable key order, 2-space indent) so it can be golden-
tested. It is real, renderable Jinja: `emit_jinja(g)` rendered with `resolved={}`
yields placeholders; rendered with the full resolved map yields concrete JSON.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from app.generator.graph import (
    Binding,
    Kind,
    Lit,
    Node,
    OutRef,
    Ref,
    ServiceGraph,
    out_path,
    path_key,
)

_HEADER = """\
{# build-json.j2 — inputs: request (dict), resolved (dict: path -> value) #}
{%- macro ph(path) -%}
  {%- if path in resolved -%}{{ resolved[path] | tojson }}
  {%- else -%}"<<{{ path }}>>"{%- endif -%}
{%- endmacro -%}
"""


@dataclass(frozen=True)
class _Expr:
    """A raw Jinja expression emitted verbatim (not JSON-quoted)."""

    text: str


def _request(field: str) -> _Expr:
    return _Expr(f"{{{{ request.{field} | tojson }}}}")


def _placeholder(path: str) -> _Expr:
    return _Expr(f'{{{{ ph("{path}") }}}}')


def _url(template: str) -> object:
    """A url config value -> a plain string (static) or a Jinja concat expression.

    ``.../accounts?name={app_name}`` becomes
    ``{{ ("...name=" ~ request.app_name) | tojson }}`` (design §6, made renderable).
    """
    parts = re.split(r"\{(\w+)\}", template)
    if len(parts) == 1:
        return template
    segs: list[str] = []
    for i, part in enumerate(parts):
        if i % 2 == 0:
            if part:
                segs.append(json.dumps(part))
        else:
            segs.append(f"request.{part}")
    return _Expr("{{ (" + " ~ ".join(segs) + ") | tojson }}")


def _binding(graph: ServiceGraph, binding: Binding) -> object:
    if isinstance(binding, Ref):
        return _request(binding.field)
    if isinstance(binding, OutRef):
        return _placeholder(out_path(graph, binding))
    assert isinstance(binding, Lit)
    return binding.value


def _scalar(graph: ServiceGraph, node: Node, name: str) -> object:
    """Resolve a scalar input binding to its emitted value."""
    binding = node.input_bindings[name]
    assert not isinstance(binding, dict), f"{name} is a map-shaped input, not a scalar"
    return _binding(graph, binding)


def _url_value(graph: ServiceGraph, node: Node) -> object:
    """Resolve the `url` input, applying `_url()` templating when it is a literal
    string (a Ref/OutRef resolves to a Jinja expression left untouched)."""
    value = _scalar(graph, node, "url")
    return _url(value) if isinstance(value, str) else value


def _map_input(graph: ServiceGraph, node: Node, name: str) -> dict:
    """Resolve a map-shaped input (`body`/`rules`) to ``{key: emitted value}``."""
    value = node.input_bindings.get(name, {})
    assert isinstance(value, dict)
    return {k: _binding(graph, b) for k, b in value.items()}


def _payload(graph: ServiceGraph, main: Node) -> dict:
    return {
        "method": _scalar(graph, main, "method"),
        "url": _url_value(graph, main),
        "body": _map_input(graph, main, "body"),
    }


def _child(graph: ServiceGraph, dep: Node) -> dict:
    return {
        "service": dep.block,
        "action": dep.action,
        # dependency inputs are scalar bindings (a dep never takes a map-shaped input).
        "inputs": {k: _binding(graph, b) for k, b in dep.input_bindings.items() if not isinstance(b, dict)},
        "outputs": {o: _placeholder(out_path(graph, OutRef(dep.id, o))) for o in dep.outputs},
        "mapping": {"children": {}, "internals": {}},
    }


def _internal(graph: ServiceGraph, call: Node, extractor: Node | None) -> dict:
    entry: dict = {
        "type": "api-call",
        "request": {"method": _scalar(graph, call, "method"), "url": _url_value(graph, call)},
    }
    owner = extractor or call
    if extractor is not None:
        entry["extract"] = _map_input(graph, extractor, "rules")
    entry["outputs"] = {
        o: _placeholder(f"mapping.internals.{path_key(call.id)}.outputs.{o}")
        for o in owner.outputs
    }
    return entry


def _tree(graph: ServiceGraph) -> dict:
    deps = sorted((n for n in graph.nodes if n.kind is Kind.DEPENDENCY), key=lambda n: n.id)
    api_calls = sorted(
        (n for n in graph.nodes if n.kind is Kind.INTERNAL and n.block == "api-call"),
        key=lambda n: n.id,
    )
    extractors = [n for n in graph.nodes if n.kind is Kind.INTERNAL and n.block == "json-extractor"]

    def extractor_for(call: Node) -> Node | None:
        for ex in extractors:
            src = ex.input_bindings.get("source")
            if isinstance(src, OutRef) and src.node == call.id:
                return ex
        return None

    return {
        "payload": _payload(graph, graph.main),
        "mapping": {
            "children": {path_key(d.id): _child(graph, d) for d in deps},
            "internals": {
                path_key(c.id): _internal(graph, c, extractor_for(c)) for c in api_calls
            },
        },
    }


def _dumps(value: object, indent: int = 0) -> str:
    pad, pad1 = "  " * indent, "  " * (indent + 1)
    if isinstance(value, _Expr):
        return value.text
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = [f"{pad1}{json.dumps(k)}: {_dumps(v, indent + 1)}" for k, v in value.items()]
        return "{\n" + ",\n".join(items) + "\n" + pad + "}"
    if isinstance(value, list):
        if not value:
            return "[]"
        items = [f"{pad1}{_dumps(v, indent + 1)}" for v in value]
        return "[\n" + ",\n".join(items) + "\n" + pad + "]"
    return json.dumps(value)


def emit_jinja(graph: ServiceGraph) -> str:
    """The `build-json.j2` template string for one verb's graph."""
    return _HEADER + _dumps(_tree(graph)) + "\n"
