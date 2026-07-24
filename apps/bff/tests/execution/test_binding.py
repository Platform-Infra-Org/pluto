"""Task 1: workflow binding + parameter mapping.

Binding (template + field->param map) comes from the Service Definition (E08);
until then a static config stub. These tests pin the mapping contract: declared
params are pulled from the source by dotted path and stringified; a missing
required field errors.
"""

import json

import pytest

from app.execution.binding import Binding, MissingParam, map_params, resolve_binding


def test_resolve_binding_returns_template_and_map():
    b = resolve_binding("database", "UPDATE")
    assert isinstance(b, Binding)
    assert b.template_ref  # a WorkflowTemplate name
    assert isinstance(b.param_map, dict) and b.param_map


def test_map_params_pulls_declared_fields_and_stringifies():
    source = {
        "action": "UPDATE",
        "resource_type": "database",
        "resource_id": 7,
        "payload": {"spec": {"engine": "pg16"}},
    }
    param_map = {
        "action": "action",
        "resource-type": "resource_type",
        "resource-id": "resource_id",
        "spec": "payload.spec",
    }
    params = map_params(source, param_map)
    assert params["action"] == "UPDATE"
    assert params["resource-type"] == "database"
    assert params["resource-id"] == "7"  # coerced to str
    assert params["spec"] == json.dumps({"engine": "pg16"}, sort_keys=True)
    assert all(isinstance(v, str) for v in params.values())


def test_map_params_missing_required_field_errors():
    with pytest.raises(MissingParam):
        map_params({"action": "UPDATE"}, {"spec": "payload.spec"})
