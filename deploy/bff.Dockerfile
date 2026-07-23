# Build context: repo root. Build with:
#   docker build -f deploy/bff.Dockerfile -t platform-bff .
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /uvx /bin/

WORKDIR /app
COPY apps/bff/pyproject.toml apps/bff/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY apps/bff/app ./app
COPY apps/bff/migrations ./migrations
COPY apps/bff/alembic.ini ./alembic.ini

FROM python:3.12-slim

WORKDIR /app
COPY --from=builder /app /app
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
