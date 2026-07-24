"""FastAPI auth dependencies. Authorization is enforced here, server-side."""

from collections.abc import Awaitable, Callable

from fastapi import Depends, Header, HTTPException, status

from app.auth.jwt import AuthError, verify_token
from app.auth.principal import Principal, build_principal


async def current_principal(
    authorization: str | None = Header(default=None),
) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        claims = await verify_token(token)
    except AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token") from exc
    return build_principal(claims)


def require_role(role: str) -> Callable[..., Awaitable[Principal]]:
    async def dep(principal: Principal = Depends(current_principal)) -> Principal:
        if role not in principal.roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"requires role {role}")
        return principal

    return dep


async def writer_principal(
    principal: Principal = Depends(current_principal),
) -> Principal:
    """current_principal for mutating endpoints: the read-only `auditor` role is
    refused (separation of duties — an auditor changes nothing)."""
    if "auditor" in principal.roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "auditor is read-only")
    return principal


def require_any(*roles: str) -> Callable[..., Awaitable[Principal]]:
    wanted = set(roles)

    async def dep(principal: Principal = Depends(current_principal)) -> Principal:
        if not wanted & principal.roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, f"requires any of {sorted(wanted)}"
            )
        return principal

    return dep
