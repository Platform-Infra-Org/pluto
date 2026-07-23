"""Build a Principal from validated token claims.

RBAC follows the ArgoCD union pattern: roles/teams are the union across every
matched group, with deny-takes-precedence for conflicts.
"""

from dataclasses import dataclass

from app.config import settings


@dataclass
class Principal:
    sub: str
    username: str
    groups: list[str]
    roles: set[str]
    teams: set[str]


def build_principal(claims: dict) -> Principal:
    raw = claims.get(settings.oidc_groups_claim) or []
    # Keycloak group paths are often "/name"; match on the bare name.
    groups = [g.lstrip("/") for g in raw]

    roles: set[str] = set()
    teams: set[str] = set()
    denied: set[str] = set()
    for g in groups:
        entry = settings.role_group_map.get(g)
        if not entry:
            continue
        roles.update(entry.get("roles", []))
        teams.update(entry.get("teams", []))
        denied.update(entry.get("deny", []))

    return Principal(
        sub=claims["sub"],
        username=claims.get("preferred_username", claims["sub"]),
        groups=groups,
        roles=roles - denied,
        teams=teams,
    )
