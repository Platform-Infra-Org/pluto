"""fn-json-extractor — JSONPath-extract curated outputs from a response (design §8).

``rules`` is ``{output_name: jsonpath_expr}``; each is evaluated against ``source``
and the first match becomes the output value. A rule that matches nothing raises a
clear error naming the output and the path — never a silent ``None``.
"""

from __future__ import annotations

from typing import Any

from jsonpath_ng.ext import parse


def extract(source: Any, rules: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for name, path in rules.items():
        matches = parse(path).find(source)
        if not matches:
            raise KeyError(f"json-extractor rule {name!r}: no match for path {path!r}")
        out[name] = matches[0].value
    return out
