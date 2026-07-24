"""save_graphs derives the request form's JSON Schema from the graph request fields
so an onboarded type is requestable WITH its fields (not an empty form)."""

from app.services.compose import _form_schema_from_graphs, _json_type


def test_json_type_maps_scalars_and_enum():
    assert _json_type("string") == {"type": "string"}
    assert _json_type("number") == {"type": "number"}
    assert _json_type("boolean") == {"type": "boolean"}
    assert _json_type("json") == {"type": "object"}
    assert _json_type("enum[GET,POST]") == {"type": "string", "enum": ["GET", "POST"]}


def test_form_schema_unions_request_fields_across_verbs():
    graphs = {
        "create": {"request_fields": {"app_name": "string", "size": "enum[small,large]"}, "nodes": []},
        "delete": {"request_fields": {"app_name": "string"}, "nodes": []},
    }
    schema = _form_schema_from_graphs(graphs)
    assert schema["type"] == "object"
    assert schema["properties"]["app_name"] == {"type": "string"}
    assert schema["properties"]["size"] == {"type": "string", "enum": ["small", "large"]}
    assert set(schema["required"]) == {"app_name", "size"}


def test_form_schema_empty_when_no_request_fields():
    assert _form_schema_from_graphs({"create": {"nodes": []}}) == {
        "type": "object", "properties": {}, "required": []
    }
