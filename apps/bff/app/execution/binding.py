"""Workflow binding + parameter mapping (E06 Task 1).

A `Binding` names the WorkflowTemplate to submit and a `param_map` of
workflow-param-name -> dotted path into a source dict (the request's action,
resource_type, payload, ...). `map_params` extracts + stringifies each declared
param; a missing required field errors before we ever hit Argo.

E08 SEAM: bindings live on the resource type's Service Definition. Until E08
lands there is one static default binding for every (resource_type, action).
Register a real per-type lookup in `_BINDINGS` when E08 exists.
"""

from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass(frozen=True)
class Binding:
    template_ref: str  # WorkflowTemplate name to submit
    param_map: dict[str, str]  # workflow param name -> dotted path into the source


class MissingParam(Exception):
    """A declared workflow parameter has no value in the source payload."""


# ponytail: single default binding — the E08 service-definition lookup replaces it.
_DEFAULT = Binding(
    template_ref="resource-change",
    param_map={
        "action": "action",
        "resource-type": "resource_type",
        "resource-payload": "payload",
    },
)
_BINDINGS: dict[tuple[str, str], Binding] = {}


def resolve_binding(resource_type: str, action: str) -> Binding:
    return _BINDINGS.get((resource_type, action), _DEFAULT)


def _dig(source: dict, path: str):
    cur = source
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            raise MissingParam(path)
        cur = cur[part]
    return cur


def _stringify(val) -> str:
    if isinstance(val, str):
        return val
    if isinstance(val, (dict, list)):
        return json.dumps(val, sort_keys=True)  # stable => idempotent submits
    return str(val)


def map_params(payload: dict, param_map: dict[str, str]) -> dict[str, str]:
    """Map declared workflow params out of `payload` by dotted path; stringify.
    Raises MissingParam if a declared field is absent."""
    return {name: _stringify(_dig(payload, path)) for name, path in param_map.items()}
