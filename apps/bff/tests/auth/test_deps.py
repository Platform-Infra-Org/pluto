import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api import me
from app.auth.deps import require_any, require_role


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(me.router)

    @app.get("/admin-only", dependencies=[Depends(require_role("platform-admin"))])
    def admin_only():
        return {"ok": True}

    @app.get("/staff", dependencies=[Depends(require_any("requester", "platform-admin"))])
    def staff():
        return {"ok": True}

    return TestClient(app, raise_server_exceptions=True)


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_no_token_is_401(client):
    assert client.get("/api/me").status_code == 401
    assert client.get("/admin-only").status_code == 401


def test_wrong_role_is_403(fake_jwks, make_token, client):
    token = make_token(groups=["requesters"])  # requester, not admin
    assert client.get("/admin-only", headers=auth(token)).status_code == 403


def test_right_role_is_200(fake_jwks, make_token, client):
    token = make_token(groups=["platform-admins"])
    assert client.get("/admin-only", headers=auth(token)).status_code == 200


def test_require_any_allows_either(fake_jwks, make_token, client):
    token = make_token(groups=["requesters"])
    assert client.get("/staff", headers=auth(token)).status_code == 200


def test_invalid_token_is_401(fake_jwks, make_token, client):
    token = make_token() + "tampered"
    assert client.get("/api/me", headers=auth(token)).status_code == 401


def test_me_returns_roles_and_teams(fake_jwks, make_token, client):
    token = make_token(groups=["platform-admins", "owners-payments"])
    r = client.get("/api/me", headers=auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["sub"] == "user-123"
    assert body["roles"] == ["platform-admin"]
    assert body["teams"] == ["payments"]
