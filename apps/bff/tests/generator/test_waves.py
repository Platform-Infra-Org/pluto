"""CB02 Task 2 — topological wave grouping (deterministic; main is last)."""

from __future__ import annotations

from app.generator.waves import waves
from tests.generator import fixtures


def test_app_database_waves():
    g = fixtures.app_database_create()
    # dependencies before internals within a wave, then by id (deterministic)
    assert waves(g) == [
        ["network", "lookup-account"],
        ["extract-account"],
        ["main"],
    ]


def test_main_is_always_last():
    g = fixtures.app_database_create()
    assert waves(g)[-1] == ["main"]


def test_delete_single_main_is_one_wave():
    assert waves(fixtures.app_database_delete()) == [["main"]]


def test_ordering_is_stable():
    g = fixtures.app_database_create()
    assert waves(g) == waves(g)
