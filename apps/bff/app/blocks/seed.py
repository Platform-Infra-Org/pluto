"""Seed the v1 built-in function blocks (CB01 Task 5, design §8).

The five platform-shipped `fn-*` blocks the whole composable builder is tested
against downstream (CB02 golden tests, CB03 palette). Each is a faithful, minimal
manifest with correct typed IO per design §3/§8. `seed_builtins` is idempotent —
a block already present (any version) is skipped, so re-running never duplicates.

Manifests use YAML **block style**: type strings like `enum[...]` / `map<string,T>`
contain `,` and `[]`, which are special inside YAML flow `{}`.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.blocks.manifest import parse_manifest
from app.blocks.model import FunctionBlock
from app.blocks.registry import upsert_block

# api-call — execute an HTTP call (design §3 verbatim).
_API_CALL = """
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

# json-extractor — JSONPath-curate outputs from a response (design §3 verbatim).
_JSON_EXTRACTOR = """
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
ui:
  form: [rules]
"""

# set-value — compute/transform a value from a small expression (design §8).
_SET_VALUE = """
kind: FunctionBlock
metadata:
  name: set-value
  category: builtin
  icon: function
template:
  ref: fn-set-value
inputs:
  - name: expr
    type: string
    required: true
  - name: args
    type: json
    required: false
outputs:
  - name: value
    type: json
ui:
  form: [expr, args]
"""

# git-commit — commit the resulting resource JSON to Git, the write path (design §8).
_GIT_COMMIT = """
kind: FunctionBlock
metadata:
  name: git-commit
  category: builtin
  icon: git-branch
template:
  ref: fn-git-commit
inputs:
  - name: repo
    type: string
    required: true
  - name: path
    type: string
    required: true
  - name: content
    type: json
    required: true
outputs:
  - name: sha
    type: string
ui:
  form: [repo, path, content]
"""

# jinja-render — render build-json.j2 with request + resolved -> big JSON (design §6/§8).
_JINJA_RENDER = """
kind: FunctionBlock
metadata:
  name: jinja-render
  category: builtin
  icon: code
template:
  ref: fn-jinja-render
inputs:
  - name: template
    type: string
    required: true
  - name: request
    type: json
    required: true
  - name: resolved
    type: json
    required: false
outputs:
  - name: payload
    type: json
  - name: mapping
    type: json
ui:
  form: [template]
"""

BUILTINS = [_API_CALL, _JSON_EXTRACTOR, _SET_VALUE, _GIT_COMMIT, _JINJA_RENDER]


async def seed_builtins(session: AsyncSession) -> None:
    """Insert the v1 built-ins; skip any block name already present (idempotent)."""
    existing = set(
        (await session.scalars(select(FunctionBlock.name).distinct())).all()
    )
    for yaml_str in BUILTINS:
        manifest = parse_manifest(yaml_str)
        if manifest.name in existing:
            continue
        await upsert_block(session, manifest, created_by="platform")
