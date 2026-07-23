"""Validate Keycloak-issued JWTs against the realm's JWKS.

verify_token checks signature, issuer, audience and expiry, returning the
claims dict. Anything wrong raises AuthError.
"""

import time

import httpx
from jose import jwt
from jose.exceptions import JWTError

from app.config import settings

_JWKS_TTL = 3600.0
_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0


class AuthError(Exception):
    """Token failed validation (bad signature / issuer / audience / expiry)."""


async def _fetch_jwks() -> dict:
    url = f"{settings.oidc_issuer_url.rstrip('/')}/protocol/openid-connect/certs"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=5.0)
        resp.raise_for_status()
        return resp.json()


async def get_jwks(force: bool = False) -> dict:
    global _jwks_cache, _jwks_fetched_at
    now = time.monotonic()
    if force or _jwks_cache is None or now - _jwks_fetched_at > _JWKS_TTL:
        _jwks_cache = await _fetch_jwks()
        _jwks_fetched_at = now
    return _jwks_cache


async def verify_token(token: str) -> dict:
    jwks = await get_jwks()
    try:
        return jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.oidc_client_id_spa,
            issuer=settings.oidc_issuer_url,
        )
    except JWTError as exc:
        raise AuthError(str(exc)) from exc
