"""fn-set-value — compute/transform a value from a small expression (design §8).

The expression is a single Jinja expression evaluated over ``args`` in a
``SandboxedEnvironment`` — arithmetic, concatenation (``~``), filters — with no
arbitrary Python access. Reuses jinja2 rather than shipping an expression parser.
"""

from __future__ import annotations

from typing import Any

from jinja2.sandbox import SandboxedEnvironment

_ENV = SandboxedEnvironment()


def set_value(expr: str, args: dict[str, Any] | None = None) -> Any:
    return _ENV.compile_expression(expr)(**(args or {}))
