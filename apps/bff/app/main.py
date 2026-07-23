import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import catalog, me
from app.catalog.git_sync import sync_repo
from app.config import settings

log = logging.getLogger(__name__)


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
        yield
    finally:
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


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
