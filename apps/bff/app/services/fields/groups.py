"""Groups picker field — scoped Keycloak group lookup (E08 Task 3).

A select whose options are Keycloak groups, served by the BFF from its
privileged directory access — the browser never queries Keycloak directly. The
lookup is always **scoped** to limit exposure: either a name prefix
(`prefix:<x>`, passed to Keycloak's `search`) or the requester's own groups
(`mine`, from their `groups` claim). An unscoped request that would return the
whole directory is refused.

Live acceptance against a real Keycloak (the admin token via the confidential
client) is DEFERRED — no Keycloak here. Unit tests inject a mock transport.
"""

from __future__ import annotations

import httpx

from app.config import settings

MAX_RESULTS = 200


class ScopeRequired(Exception):
    """The lookup has no scope; refusing to return the whole directory (API -> 400)."""


async def list_groups(
    scope: str | None,
    *,
    requester_groups: list[str],
    client: httpx.AsyncClient | None = None,
) -> list[dict]:
    """Return scoped Keycloak groups as `[{id?, name, path}, ...]`.

    `scope="mine"` -> the requester's own groups (from their claim; no directory
    call). `scope="prefix:<x>"` -> Keycloak groups whose name matches `<x>`.
    Anything that would list the whole directory raises ScopeRequired.
    """
    if not scope or scope in ("all", "*"):
        raise ScopeRequired(
            "groups picker requires a scope (mine or prefix:<x>); "
            "refusing to return the whole directory"
        )
    if scope == "mine":
        return [{"name": g, "path": f"/{g}"} for g in requester_groups]
    if scope.startswith("prefix:"):
        prefix = scope.split(":", 1)[1].strip()
        if not prefix:
            raise ScopeRequired("empty prefix would return the whole directory")
        if client is None:
            raise ValueError("prefix scope requires a Keycloak admin client")
        resp = await client.get(
            "/groups", params={"search": prefix, "max": MAX_RESULTS}
        )
        resp.raise_for_status()
        return [
            {"id": g.get("id"), "name": g.get("name"), "path": g.get("path")}
            for g in resp.json()
        ]
    raise ScopeRequired(f"unsupported scope {scope!r}")


async def _admin_token(token_client: httpx.AsyncClient) -> str:
    """Client-credentials token for the BFF confidential client (live path).

    DEFERRED: exercised only against a real Keycloak; unit tests inject a client
    that already carries auth.
    """
    resp = await token_client.post(
        f"{settings.oidc_issuer_url}/protocol/openid-connect/token",
        data={
            "grant_type": "client_credentials",
            "client_id": settings.oidc_client_id_bff,
            "client_secret": settings.oidc_client_secret_bff,
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


async def admin_client() -> httpx.AsyncClient:
    """Build a Keycloak Admin API client authenticated as the BFF (live path)."""
    async with httpx.AsyncClient() as token_client:
        token = await _admin_token(token_client)
    return httpx.AsyncClient(
        base_url=settings.keycloak_admin_base_url,
        headers={"Authorization": f"Bearer {token}"},
    )
