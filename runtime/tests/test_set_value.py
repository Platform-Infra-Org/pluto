"""fn-set-value — compute/transform a value from a small expression (design §8).

The expression engine is a sandboxed Jinja expression over ``args`` — no arbitrary
Python eval — reusing the already-present jinja2 dep.
"""

from __future__ import annotations

import pytest
from jinja2.exceptions import SecurityError

from fn.set_value import set_value


def test_string_concat() -> None:
    assert set_value("prefix ~ name", {"prefix": "app-", "name": "42"}) == "app-42"


def test_arithmetic() -> None:
    assert set_value("count * 2", {"count": 3}) == 6


def test_filter_transform() -> None:
    assert set_value("name | upper", {"name": "app"}) == "APP"


def test_no_args() -> None:
    assert set_value("1 + 1", {}) == 2


def test_no_arbitrary_eval() -> None:
    # the sandbox blocks dunder access — no escape to the type/class hierarchy.
    # classic payloads raise SecurityError.
    with pytest.raises(SecurityError):
        set_value("().__class__.__bases__[0].__subclasses__()")
    with pytest.raises(SecurityError):
        set_value("x.__init__.__globals__", {"x": lambda: None})
    # benign expressions still evaluate correctly (sandbox works, not just broken).
    assert set_value("1 + 1") == 2
    assert set_value("'hello' ~ ' ' ~ 'world'") == "hello world"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
