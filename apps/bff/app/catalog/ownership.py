"""Resolve a resource's owner team by precedence:
metadata.ownerTeam -> git-path prefix map (config) -> default team.

The owner team string must match the Keycloak group used in the `groups` claim
so approval authorization (E05) lines up.
"""

from app.config import settings


def resolve_owner_team(payload: dict, git_path: str) -> str:
    owner = (payload.get("metadata") or {}).get("ownerTeam")
    if owner:
        return owner
    for prefix, team in settings.ownership_path_map.items():
        if git_path.startswith(prefix):
            return team
    return settings.default_owner_team
