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


def test_verify_rejects_bad_signature(fake_jwks, valid_token):
    tampered = valid_token[:-3] + ("aaa" if valid_token[-3:] != "aaa" else "bbb")
    with pytest.raises(AuthError):
        anyio.run(verify_token, tampered)
