"""Manifest schema + parser/validator + type assignability (CB01 Task 1)."""

import pytest

from app.blocks.manifest import ManifestError, is_assignable, parse_manifest, parse_type

# Block-style YAML: type strings like `enum[...]` / `map<string,T>` contain `,`
# and `[]`, which are special inside YAML flow `{}` — so manifests use block style.
API_CALL_YAML = """
apiVersion: platform/v1
kind: FunctionBlock
metadata:
  name: api-call
  category: builtin
  icon: globe
template:
  ref: fn-api-call
inputs:
  - name: method
    type: enum[GET,POST,PUT,DELETE]
    required: true
  - name: url
    type: string
    required: true
  - name: body
    type: json
    required: false
  - name: headers
    type: json
    required: false
outputs:
  - name: status
    type: number
  - name: response
    type: json
ui:
  form: [method, url, body, headers]
"""

JSON_EXTRACTOR_YAML = """
kind: FunctionBlock
metadata:
  name: json-extractor
  category: builtin
  icon: filter
template:
  ref: fn-json-extractor
inputs:
  - name: source
    type: json
    required: true
  - name: rules
    type: map<string,jsonpath>
    required: true
outputs:
  - name: extracted
    type: json
"""


def test_parse_api_call_typed_io():
    m = parse_manifest(API_CALL_YAML)
    assert m.name == "api-call"
    assert m.category == "builtin"
    assert m.icon == "globe"
    assert m.template_ref == "fn-api-call"
    assert [i.name for i in m.inputs] == ["method", "url", "body", "headers"]

    method = m.inputs[0]
    assert method.required is True
    assert method.type.kind == "enum"
    assert list(method.type.values) == ["GET", "POST", "PUT", "DELETE"]
    # str form round-trips
    assert str(method.type) == "enum[GET,POST,PUT,DELETE]"

    body = m.inputs[2]
    assert body.type.kind == "json" and body.required is False

    outs = {o.name: o.type.kind for o in m.outputs}
    assert outs == {"status": "number", "response": "json"}
    assert m.ui == {"form": ["method", "url", "body", "headers"]}


def test_parse_json_extractor_map_type():
    m = parse_manifest(JSON_EXTRACTOR_YAML)
    assert m.template_ref == "fn-json-extractor"
    rules = m.inputs[1]
    assert rules.type.kind == "map"
    assert rules.type.key_type.kind == "string"
    assert rules.type.value_type.kind == "jsonpath"
    assert str(rules.type) == "map<string,jsonpath>"


def test_unknown_type_raises():
    bad = """
kind: FunctionBlock
metadata: { name: bad, category: builtin }
template: { ref: fn-bad }
inputs:
  - { name: x, type: widget, required: true }
outputs: []
"""
    with pytest.raises(ManifestError):
        parse_manifest(bad)


def test_missing_template_ref_raises():
    bad = """
kind: FunctionBlock
metadata: { name: bad, category: builtin }
inputs: []
outputs: []
"""
    with pytest.raises(ManifestError):
        parse_manifest(bad)


def test_missing_field_name_raises():
    bad = """
kind: FunctionBlock
metadata: { name: bad, category: builtin }
template: { ref: fn-bad }
inputs:
  - { type: string, required: true }
outputs: []
"""
    with pytest.raises(ManifestError):
        parse_manifest(bad)


def test_assignability():
    string = parse_type("string")
    number = parse_type("number")
    js = parse_type("json")
    # json is the permissive top type: anything -> json.
    assert is_assignable(string, js) is True
    assert is_assignable(number, js) is True
    # but json is not assignable down into a concrete type.
    assert is_assignable(js, number) is False
    # same type ok; mismatched concrete types rejected.
    assert is_assignable(string, string) is True
    assert is_assignable(string, number) is False
    # enum subset -> wider enum ok; not the reverse.
    narrow = parse_type("enum[GET]")
    wide = parse_type("enum[GET,POST]")
    assert is_assignable(narrow, wide) is True
    assert is_assignable(wide, narrow) is False
    # map recurses on value type.
    assert is_assignable(parse_type("map<string,jsonpath>"), parse_type("map<string,json>")) is True
    assert is_assignable(parse_type("map<string,json>"), parse_type("map<string,jsonpath>")) is False
