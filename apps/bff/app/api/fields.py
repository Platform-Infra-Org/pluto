"""Server-backed form fields API (E08): groups picker, upload, dynamic options.

Every field's data is served by the BFF, never fetched by the browser from the
underlying system (Keycloak / object store / external API).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.services.fields import groups

router = APIRouter(prefix="/api/fields")

# Indirection so tests can swap the Keycloak admin client for a mock transport.
_kc_client_factory = groups.admin_client


@router.get("/groups")
async def groups_field(
    scope: str | None = None,
    principal: Principal = Depends(current_principal),
) -> dict:
    """Scoped Keycloak groups. `mine` needs no directory call; `prefix:<x>` does."""
    client = None
    try:
        if scope and scope.startswith("prefix:"):  # only prefix scopes hit Keycloak
            client = await _kc_client_factory()
        items = await groups.list_groups(
            scope, requester_groups=principal.groups, client=client
        )
    except groups.ScopeRequired as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    finally:
        if client is not None:
            await client.aclose()
    return {"items": items}
