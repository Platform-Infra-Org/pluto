"""Shared auth-test fixtures: a real RSA keypair signs tokens, and its public
half is served through a fake JWKS so no live Keycloak is needed."""

import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk
from jose import jwt as jose_jwt

from app.config import settings

KID = "test-key"


@pytest.fixture(scope="session")
def rsa_private_pem() -> str:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()


@pytest.fixture
def fake_jwks(rsa_private_pem, monkeypatch):
    """Patch the JWKS fetch to return our test key and reset the cache."""
    from app.auth import jwt as jwt_mod

    pub = jwk.construct(rsa_private_pem, algorithm="RS256").public_key().to_dict()
    pub.update({"kid": KID, "use": "sig", "alg": "RS256"})
    jwks = {"keys": [pub]}

    async def _fake_fetch() -> dict:
        return jwks

    monkeypatch.setattr(jwt_mod, "_fetch_jwks", _fake_fetch)
    monkeypatch.setattr(jwt_mod, "_jwks_cache", None)
    return jwks


@pytest.fixture
def make_token(rsa_private_pem):
    """Factory signing a token with the test key. Override any claim via kwargs;
    pass a claim as None to drop it entirely, or kid= to sign under another key id."""

    def _make(kid: str = KID, **overrides) -> str:
        now = int(time.time())
        claims = {
            "sub": "user-123",
            "iss": settings.oidc_issuer_url,
            "aud": settings.oidc_client_id_spa,
            "iat": now,
            "exp": now + 3600,
            "preferred_username": "alice",
            settings.oidc_groups_claim: [],
        }
        claims.update(overrides)
        claims = {k: v for k, v in claims.items() if v is not None}
        return jose_jwt.encode(
            claims, rsa_private_pem, algorithm="RS256", headers={"kid": kid}
        )

    return _make


@pytest.fixture
def valid_token(make_token) -> str:
    return make_token()


@pytest.fixture
def expired_token(make_token) -> str:
    return make_token(exp=int(time.time()) - 60)
