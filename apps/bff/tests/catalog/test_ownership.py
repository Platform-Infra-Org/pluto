from app.catalog.ownership import resolve_owner_team


def test_metadata_owner_team_wins(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "ownership_path_map", {"resources/database/": "dba"})
    monkeypatch.setattr(settings, "default_owner_team", "platform")
    payload = {"metadata": {"ownerTeam": "payments"}}
    assert resolve_owner_team(payload, "resources/database/orders.json") == "payments"


def test_path_prefix_map_used_when_no_metadata(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(
        settings, "ownership_path_map", {"resources/search/": "search", "resources/database/": "dba"}
    )
    monkeypatch.setattr(settings, "default_owner_team", "platform")
    assert resolve_owner_team({"metadata": {}}, "resources/search/idx.json") == "search"


def test_default_when_nothing_matches(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "ownership_path_map", {"resources/search/": "search"})
    monkeypatch.setattr(settings, "default_owner_team", "platform")
    assert resolve_owner_team({}, "resources/other/x.json") == "platform"
