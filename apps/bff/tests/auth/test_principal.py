from app.auth.principal import build_principal


def test_union_of_roles_and_teams():
    claims = {
        "sub": "user-123",
        "preferred_username": "alice",
        "groups": ["platform-admins", "owners-payments"],
    }
    p = build_principal(claims)
    assert p.sub == "user-123"
    assert p.username == "alice"
    assert p.roles == {"platform-admin"}
    assert p.teams == {"payments"}


def test_union_across_two_role_groups():
    claims = {"sub": "u", "groups": ["requesters", "auditors"]}
    p = build_principal(claims)
    assert p.roles == {"requester", "auditor"}


def test_keycloak_slash_prefixed_groups_normalised():
    claims = {"sub": "u", "groups": ["/platform-admins"]}
    assert build_principal(claims).roles == {"platform-admin"}


def test_unmapped_group_grants_nothing():
    claims = {"sub": "u", "groups": ["random-ad-group"]}
    p = build_principal(claims)
    assert p.roles == set()
    assert p.teams == set()


def test_deny_takes_precedence(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(
        settings,
        "role_group_map",
        {
            "grant": {"roles": ["requester", "platform-admin"]},
            "restricted": {"deny": ["platform-admin"]},
        },
    )
    claims = {"sub": "u", "groups": ["grant", "restricted"]}
    p = build_principal(claims)
    assert p.roles == {"requester"}
