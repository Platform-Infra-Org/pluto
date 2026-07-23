import anyio
import pytest

from app.auth.jwt import AuthError, verify_token


def test_verify_valid_token(fake_jwks, valid_token):
    claims = anyio.run(verify_token, valid_token)
    assert claims["sub"] == "user-123"


def test_verify_rejects_expired(fake_jwks, expired_token):
    with pytest.raises(AuthError):
        anyio.run(verify_token, expired_token)


def test_verify_rejects_wrong_issuer(fake_jwks, make_token):
    token = make_token(iss="https://evil.example.com/realms/other")
    with pytest.raises(AuthError):
        anyio.run(verify_token, token)


def test_verify_rejects_missing_audience(fake_jwks, make_token):
    token = make_token(aud=None)
    with pytest.raises(AuthError):
        anyio.run(verify_token, token)


def test_verify_rejects_wrong_audience(fake_jwks, make_token):
    token = make_token(aud="some-other-client")
    with pytest.raises(AuthError):
        anyio.run(verify_token, token)


def test_verify_rejects_missing_issuer(fake_jwks, make_token):
    token = make_token(iss=None)
    with pytest.raises(AuthError):
        anyio.run(verify_token, token)


def test_verify_accepts_audience_list_containing_spa(fake_jwks, make_token):
    from app.config import settings

    token = make_token(aud=["account", settings.oidc_client_id_spa])
    claims = anyio.run(verify_token, token)
    assert claims["sub"] == "user-123"


def test_verify_refreshes_jwks_on_unknown_kid(rsa_private_pem, make_token, monkeypatch):
    """Keycloak key rotation: a token's kid missing from cache triggers one
    forced JWKS refresh before failing."""
    from jose import jwk

    from app.auth import jwt as jwt_mod

    pub = jwk.construct(rsa_private_pem, algorithm="RS256").public_key().to_dict()
    rotated = {**pub, "kid": "rotated-key", "use": "sig", "alg": "RS256"}

    calls = {"n": 0}

    async def _fake_fetch() -> dict:
        calls["n"] += 1
        # Initial cache lacks the rotated key; the forced refetch delivers it.
        return {"keys": [rotated]} if calls["n"] > 1 else {"keys": []}

    monkeypatch.setattr(jwt_mod, "_fetch_jwks", _fake_fetch)
    monkeypatch.setattr(jwt_mod, "_jwks_cache", None)
    monkeypatch.setattr(jwt_mod, "_jwks_fetched_at", 0.0)

    token = make_token(kid="rotated-key")
    claims = anyio.run(verify_token, token)
    assert claims["sub"] == "user-123"
    assert calls["n"] == 2  # initial fetch + one forced refresh


def test_verify_rejects_bad_signature(fake_jwks, valid_token):
    tampered = valid_token[:-3] + ("aaa" if valid_token[-3:] != "aaa" else "bbb")
    with pytest.raises(AuthError):
        anyio.run(verify_token, tampered)
