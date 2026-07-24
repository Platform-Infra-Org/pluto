import asyncio
import contextlib
import logging
import re
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import catalog, me, requests, workflow_status
from app.catalog.git_sync import sync_repo
from app.config import settings
from app.notifications import sse

log = logging.getLogger(__name__)

# The SSE token rides in the query string (EventSource can't set headers), so it
# lands in uvicorn/proxy access logs and error traces. Redact it there.
# ponytail: cookie-based SSE auth once the BFF session endpoint exists (E02 gap)
# removes the token from the URL and makes this filter unnecessary.
_ACCESS_TOKEN_RE = re.compile(r"(access_token=)[^&\s\"']+")


class RedactAccessTokenFilter(logging.Filter):
    """Rewrites `access_token=<value>` -> `access_token=REDACTED` in log lines."""

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        redacted = _ACCESS_TOKEN_RE.sub(r"\1REDACTED", msg)
        if redacted != msg:
            record.msg = redacted
            record.args = ()
        return True


def _install_log_redaction() -> None:
    f = RedactAccessTokenFilter()
    for name in ("uvicorn.access", "uvicorn.error"):
        logging.getLogger(name).addFilter(f)


_install_log_redaction()


async def _reconcile_loop(interval: int = 300) -> None:
    """Fallback reconcile in case a webhook is missed. ponytail: a plain sleep
    loop, not a scheduler — swap for a real scheduler only if timing matters."""
    while True:
        await asyncio.sleep(interval)
        try:
            await sync_repo()
        except Exception:  # noqa: BLE001 — never let the loop die
            log.exception("catalog reconcile failed")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    task = None
    if settings.git_repo_url:
        task = asyncio.create_task(_reconcile_loop())
    try:
        await sse.fanout.start()  # LISTEN for cross-replica notification fan-out
    except Exception:  # noqa: BLE001 — degrade to REST-only if PG LISTEN is down
        log.exception("notification fan-out failed to start")
    try:
        yield
    finally:
        await sse.fanout.stop()
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


app = FastAPI(title="Platform BFF", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(me.router)
app.include_router(catalog.router)
app.include_router(requests.router)
app.include_router(workflow_status.router)
app.include_router(sse.router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
