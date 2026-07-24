"""fn-json-extractor — JSONPath-curate outputs from a response (design §8)."""

from __future__ import annotations

import pytest

from fn.json_extract import extract

RESPONSE = {"items": [{"id": "acc-9", "name": "app-42"}, {"id": "acc-10"}]}


def test_extract_per_rule() -> None:
    out = extract(RESPONSE, {"account_id": "$.items[0].id"})
    assert out == {"account_id": "acc-9"}


def test_extract_multiple_rules() -> None:
    out = extract(RESPONSE, {"first": "$.items[0].id", "name": "$.items[0].name"})
    assert out == {"first": "acc-9", "name": "app-42"}


def test_missing_path_is_clear_error() -> None:
    with pytest.raises(KeyError, match="account_id"):
        extract(RESPONSE, {"account_id": "$.items[9].id"})


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
