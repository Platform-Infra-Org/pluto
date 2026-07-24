"""CB02 Task 1 — graph validation (DAG, types, one main, bindings, block exists)."""

from __future__ import annotations

from app.generator.validate import validate
from tests.generator import fixtures


def _msgs(errs):
    return " | ".join(str(e) for e in errs)


def test_valid_app_database_create_has_no_errors():
    g = fixtures.app_database_create()
    assert validate(g, fixtures.blocks()) == []


def test_two_mains_rejected():
    errs = validate(fixtures.two_mains(), fixtures.blocks())
    assert any("main" in str(e) for e in errs), _msgs(errs)


def test_missing_required_binding_rejected():
    errs = validate(fixtures.missing_required(), fixtures.blocks())
    assert any("url" in str(e) for e in errs), _msgs(errs)


def test_type_incompatible_wire_rejected():
    errs = validate(fixtures.bad_type_wire(), fixtures.blocks())
    assert any("url" in str(e) and "number" in str(e) for e in errs), _msgs(errs)


def test_cycle_rejected():
    errs = validate(fixtures.cyclic(), fixtures.blocks())
    assert any("cycle" in str(e).lower() for e in errs), _msgs(errs)


def test_unknown_block_rejected():
    errs = validate(fixtures.unknown_block(), fixtures.blocks())
    assert any("nope-service" in str(e) for e in errs), _msgs(errs)
