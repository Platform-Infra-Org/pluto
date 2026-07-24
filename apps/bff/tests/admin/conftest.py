"""Reuse the hardening fixtures (compose Postgres + dependency overrides)."""

import pytest

from app.config import settings
from tests.hardening.conftest import client, session  # noqa: F401


@pytest.fixture(autouse=True)
def _restore_ownership_settings():
    """The ownership PUT mutates the shared settings object; snapshot + restore
    so a test that edits routing never leaks into the next one."""
    path_map = dict(settings.ownership_path_map)
    default_team = settings.default_owner_team
    yield
    settings.ownership_path_map = path_map
    settings.default_owner_team = default_team
