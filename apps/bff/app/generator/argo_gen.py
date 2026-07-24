"""Emit the Argo `WorkflowTemplate` (design §7) — one object per service.

`spec.templates` holds **one template per defined verb** (opt-in subset of
create/update/delete); each verb compiles its own graph into a DAG:

    render-0  ->  dependency + internal nodes (wired by real data deps)
              ->  render-N (re-render with the wave's resolved outputs)
              ->  main-call

Dependencies are invoked via `templateRef {name: <service>, template: <verb>}`
(recursion by reference, never inlined). A json-extractor reads its source api-call
task output directly and its result is namespaced under that api-call's path.
Output is block-style YAML with stable key order — golden-testable.
"""

from __future__ import annotations

import json

import yaml

from app.blocks.manifest import BlockManifest
from app.generator.graph import (
    Kind,
    Node,
    OutRef,
    ServiceGraph,
    out_path,
    path_key,
)
from app.generator.waves import waves

_JINJA = {"name": "fn-jinja-render", "template": "run"}
_API = {"name": "fn-api-call", "template": "run"}
_EXTRACT = {"name": "fn-json-extractor", "template": "run"}


def _param(name: str, value: str) -> dict:
    return {"name": name, "value": value}


def _flat(path: str) -> str:
    """Big-JSON path -> Argo output-parameter name (dots aren't allowed in names)."""
    return path.replace(".", "_")


def _render_task(name: str, service: str, depends: str | None, resolved: str) -> dict:
    task: dict = {"name": name}
    if depends:
        task["depends"] = depends
    task["templateRef"] = dict(_JINJA)
    task["arguments"] = {
        "parameters": [
            _param("template", f"<build-json.j2 for {service}>"),
            _param("request", "{{workflow.parameters.request}}"),
            _param("resolved", resolved),
        ]
    }
    return task


def _node_task(graph: ServiceGraph, node: Node) -> dict:
    key = path_key(node.id)
    if node.kind is Kind.DEPENDENCY:
        return {
            "name": node.id,
            "depends": "render-0",
            "templateRef": {"name": node.block, "template": node.action},
            "arguments": {
                "parameters": [
                    _param(
                        "request",
                        f"{{{{tasks.render-0.outputs.parameters.mapping_children_{key}_inputs}}}}",
                    )
                ]
            },
        }
    if node.block == "json-extractor":
        src = node.input_bindings["source"]
        assert isinstance(src, OutRef)
        return {
            "name": node.id,
            "depends": src.node,
            "templateRef": dict(_EXTRACT),
            "arguments": {
                "parameters": [
                    _param(
                        "source",
                        f"{{{{tasks.{src.node}.outputs.parameters.{src.output}}}}}",
                    ),
                    _param("rules", json.dumps(node.config.get("rules", {}))),
                ]
            },
        }
    # internal api-call
    return {
        "name": node.id,
        "depends": "render-0",
        "templateRef": dict(_API),
        "arguments": {
            "parameters": [
                _param(
                    "payload",
                    f"{{{{tasks.render-0.outputs.parameters.mapping_internals_{key}_request}}}}",
                )
            ]
        },
    }


def _producers(graph: ServiceGraph) -> list[tuple[str, str, str]]:
    """(placeholder path, producer task id, output name) for each output the main
    payload references — in body order (deterministic), de-duplicated."""
    seen: set[str] = set()
    out: list[tuple[str, str, str]] = []
    for binding in graph.main.config.get("body", {}).values():
        if isinstance(binding, OutRef):
            path = out_path(graph, binding)
            if path not in seen:
                seen.add(path)
                out.append((path, binding.node, binding.output))
    return out


def _verb_template(verb: str, graph: ServiceGraph, service: str) -> dict:
    tasks: list[dict] = [_render_task("render-0", service, None, "{}")]

    ids = graph.by_id()
    for wave in waves(graph):
        for nid in wave:
            if ids[nid].kind is not Kind.MAIN:
                tasks.append(_node_task(graph, ids[nid]))

    producers = _producers(graph)
    if producers:
        depends = " && ".join(dict.fromkeys(task for _, task, _ in producers))
        resolved = json.dumps(
            {
                path: f"{{{{tasks.{task}.outputs.parameters.{out}}}}}"
                for path, task, out in producers
            }
        )
        tasks.append(_render_task("render-1", service, depends, resolved))
        final = "render-1"
    else:
        final = "render-0"

    tasks.append(
        {
            "name": "main-call",
            "depends": final,
            "templateRef": dict(_API),
            "arguments": {
                "parameters": [
                    _param("payload", f"{{{{tasks.{final}.outputs.parameters.payload}}}}")
                ]
            },
        }
    )
    return {"name": verb, "dag": {"tasks": tasks}}


def build_workflow_template(name: str, defined: list[tuple[str, ServiceGraph]]) -> dict:
    return {
        "apiVersion": "argoproj.io/v1alpha1",
        "kind": "WorkflowTemplate",
        "metadata": {"name": name},
        "spec": {
            "arguments": {"parameters": [{"name": "request"}]},
            "templates": [_verb_template(verb, g, name) for verb, g in defined],
        },
    }


def emit_workflow_template(
    name: str,
    defined: list[tuple[str, ServiceGraph]],
    blocks: dict[str, BlockManifest] | None = None,
) -> str:
    """Serialize the single per-service WorkflowTemplate to deterministic YAML.

    `blocks` is accepted for signature symmetry with the rest of the generator;
    the emit itself needs only the graphs (validation already used the blocks).
    """
    doc = build_workflow_template(name, defined)
    return yaml.safe_dump(doc, sort_keys=False, default_flow_style=False, width=1000)
