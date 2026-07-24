"""Runner-image entrypoint: ``python -m fn.cli <block> <inputs-json>``.

Dispatches to the pure ``fn.*`` cores and writes each output value to
``$FN_OUTPUT_DIR/<name>`` (default ``/tmp/outputs``) — the files the Argo
``fn-*`` WorkflowTemplates read via ``outputs.parameters.valueFrom.path``.

Live Argo execution is deferred to a cluster; this dispatcher is exercised
directly in tests for the pure blocks.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from fn import api_call, git_commit, json_extract, render, set_value

# manifest block name (design §8) -> the fn-* WorkflowTemplate calls it by this name.
_BLOCKS = {"jinja-render", "api-call", "json-extractor", "set-value", "git-commit"}


def run(block: str, inputs: dict[str, Any]) -> dict[str, Any]:
    if block == "jinja-render":
        doc = render.render(inputs["template"], inputs["request"], inputs.get("resolved") or {})
        return {"payload": doc["payload"], "mapping": doc["mapping"]}
    if block == "api-call":
        r = api_call.call(
            inputs["method"],
            inputs["url"],
            inputs.get("body"),
            inputs.get("headers"),
            inputs.get("secret_refs"),
        )
        return {"status": r["status"], "response": r["response"]}
    if block == "json-extractor":
        return {"extracted": json_extract.extract(inputs["source"], inputs["rules"])}
    if block == "set-value":
        return {"value": set_value.set_value(inputs["expr"], inputs.get("args"))}
    if block == "git-commit":
        return {
            "sha": git_commit.commit(
                inputs["repo"], inputs["path"], inputs["content"], inputs["identity"]
            )
        }
    raise SystemExit(f"unknown block: {block!r} (expected one of {sorted(_BLOCKS)})")


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        raise SystemExit("usage: python -m fn.cli <block> <inputs-json>")
    outputs = run(argv[1], json.loads(argv[2]))
    out_dir = Path(os.environ.get("FN_OUTPUT_DIR", "/tmp/outputs"))
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, value in outputs.items():
        text = value if isinstance(value, str) else json.dumps(value)
        (out_dir / name).write_text(text)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main(sys.argv))
