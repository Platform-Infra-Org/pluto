"""derive_service_block: a ServiceDefinition -> a valid block manifest (Task 3)."""

from app.blocks.manifest import is_assignable, parse_type
from app.blocks.service_block import derive_service_block
from app.services.definition import ServiceDefinition


def _defn() -> ServiceDefinition:
    return ServiceDefinition(
        name="network",
        category="infra",
        owner_team="platform",
        form_schema={
            "type": "object",
            "properties": {
                "region": {"type": "string"},
                "size": {"type": "integer"},
                "public": {"type": "boolean"},
                "tier": {"type": "string", "enum": ["free", "pro"]},
                "spec": {"type": "object"},
            },
            "required": ["region", "tier"],
        },
        workflow_binding={"create": {"template_ref": "network", "param_map": {}}},
        status="ACTIVE",
        version=3,
    )


def test_derives_typed_inputs_from_form_fields():
    m = derive_service_block(_defn())
    assert m.name == "network"
    assert m.category == "service"
    # template_ref is the service's own WorkflowTemplate (named for the service).
    assert m.template_ref == "network"

    by = {i.name: i for i in m.inputs}
    assert by["region"].type.kind == "string" and by["region"].required is True
    assert by["size"].type.kind == "number"
    assert by["public"].type.kind == "boolean"
    assert by["tier"].type.kind == "enum" and list(by["tier"].type.values) == ["free", "pro"]
    assert by["spec"].type.kind == "json"  # object -> permissive json
    assert by["tier"].required is True
    assert by["size"].required is False


def test_manifest_is_valid_and_wireable():
    m = derive_service_block(_defn())
    # Every service block exposes its emitted resource JSON as an output that a
    # downstream json-extractor (source: json) can consume.
    assert m.outputs and m.outputs[0].type.kind == "json"
    assert is_assignable(m.outputs[0].type, parse_type("json")) is True
