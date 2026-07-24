"""An unhandled 500 must still carry CORS headers.

Starlette's ServerErrorMiddleware (which turns an unhandled exception into a 500)
sits OUTSIDE the CORS middleware, so without our catch-all handler the 500 has no
`Access-Control-Allow-Origin` and the browser reports it as a generic "NetworkError
when attempting to fetch resource" instead of a real HTTP 500 the SPA can handle.
"""

from fastapi import APIRouter
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

# Register a throwaway route that raises, so we can exercise the 500 path.
_boom = APIRouter()


@_boom.get("/api/_boom_for_test")
def _boom_route() -> None:
    raise RuntimeError("kaboom")


app.include_router(_boom)


def test_unhandled_500_carries_cors_headers() -> None:
    origin = settings.cors_origins[0]
    client = TestClient(app, raise_server_exceptions=False)
    r = client.get("/api/_boom_for_test", headers={"Origin": origin})
    assert r.status_code == 500
    # The header must be present (echoing the origin) — this is what stops the
    # browser from surfacing the error as a NetworkError.
    assert r.headers.get("access-control-allow-origin") == origin


def test_500_from_disallowed_origin_has_no_cors() -> None:
    client = TestClient(app, raise_server_exceptions=False)
    r = client.get("/api/_boom_for_test", headers={"Origin": "http://evil.example"})
    assert r.status_code == 500
    assert "access-control-allow-origin" not in r.headers
