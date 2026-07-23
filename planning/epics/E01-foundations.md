# E01 — Foundations & Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or
> superpowers:executing-plans to implement task-by-task. Steps use `- [ ]` checkboxes.

**Goal:** Stand up an empty-but-deployable monorepo — Vite/React SPA + FastAPI BFF + Postgres —
with CI, containers, and a dev deploy, so every later epic has a place to land.

**Architecture:** Monorepo with `apps/web` (SPA) and `apps/bff` (FastAPI). BFF serves `/api/*` and a
`/healthz`; SPA is built to static assets served behind the same ingress. Postgres via SQLAlchemy +
Alembic migrations. Everything containerized and deployed to a dev namespace.

**Tech Stack:** React 18 + TypeScript + Vite, TanStack Router/Query, Tailwind + shadcn/ui; Python
3.12 + FastAPI + Uvicorn, SQLAlchemy 2.x + Alembic, Pydantic v2; Postgres 16; Docker; the chosen CI.

## Global Constraints
See [README.md](README.md) → Global constraints. Python-first BFF; headless SPA; secrets from env.

## File structure

- `apps/web/` — Vite SPA: `src/main.tsx`, `src/router.tsx`, `src/lib/api.ts`, `src/app/routes/`
- `apps/bff/` — FastAPI: `app/main.py`, `app/config.py`, `app/db.py`, `app/models/`, `app/api/`
- `apps/bff/migrations/` — Alembic
- `deploy/` — Dockerfiles, k8s manifests / Helm chart, CI workflow
- `apps/bff/tests/`, `apps/web/src/**/*.test.ts`

---

### Task 1: BFF skeleton + health check

**Files:** Create `apps/bff/app/main.py`, `apps/bff/app/config.py`, `apps/bff/tests/test_health.py`

**Interfaces:**
- Produces: `GET /healthz` → `{"status":"ok"}`; `Settings` (pydantic-settings) reading `DATABASE_URL`,
  `LOG_LEVEL`, `CORS_ALLOWED_ORIGINS`, `APP_BASE_URL`.

- [ ] **Step 1: Failing test**
```python
# tests/test_health.py
from fastapi.testclient import TestClient
from app.main import app
def test_healthz():
    r = TestClient(app).get("/healthz")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
```
- [ ] **Step 2: Run** `pytest tests/test_health.py -v` → FAIL (no module `app.main`).
- [ ] **Step 3: Implement** `Settings` in `config.py` (pydantic-settings) and `app/main.py` creating
  `app = FastAPI()`, CORS middleware from `CORS_ALLOWED_ORIGINS`, and `@app.get("/healthz")`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(bff): fastapi skeleton + healthz`.

### Task 2: Postgres + Alembic + first migration

**Files:** Create `app/db.py` (async engine/session), `app/models/base.py` (DeclarativeBase),
`migrations/env.py`, `tests/test_db.py`

**Interfaces:**
- Produces: `get_session()` async dependency; `Base` for models; `alembic upgrade head` works.

- [ ] **Step 1: Failing test** — `test_db.py` opens a session against a test DB and runs `SELECT 1`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** async SQLAlchemy engine from `DATABASE_URL`, session factory, `Base`;
  init Alembic; empty baseline migration.
- [ ] **Step 4: Run** → PASS; `alembic upgrade head` succeeds on a scratch DB.
- [ ] **Step 5: Commit** `feat(bff): db session + alembic baseline`.

### Task 3: SPA skeleton + typed API client + router

**Files:** Create `apps/web/` (Vite+TS), `src/router.tsx`, `src/lib/api.ts`, `src/app/routes/home.tsx`,
`src/app/routes/home.test.tsx`; Tailwind + shadcn/ui init.

**Interfaces:**
- Produces: `apiFetch(path, init)` wrapper (adds base URL, JSON, throws on !ok); TanStack Router with a
  home route; TanStack Query provider.

- [ ] **Step 1: Failing test** (Vitest + Testing Library) — home route renders "Platform" heading.
- [ ] **Step 2: Run** `pnpm test` → FAIL.
- [ ] **Step 3: Implement** Vite app, Tailwind, shadcn/ui base, router, Query provider, `apiFetch`,
  home route.
- [ ] **Step 4: Run** → PASS; `pnpm build` produces static assets.
- [ ] **Step 5: Commit** `feat(web): vite+headless skeleton, router, api client`.

### Task 4: Containers + dev deploy + CI

**Files:** Create `deploy/bff.Dockerfile`, `deploy/web.Dockerfile`, `deploy/k8s/*.yaml` (or Helm),
`deploy/ci.yml`

- [ ] **Step 1:** Multi-stage Dockerfiles (BFF: uvicorn; web: build → nginx/static).
- [ ] **Step 2:** K8s manifests: BFF Deployment+Service, web static serve, Postgres (dev),
  Ingress with `/api`→BFF and `/`→web; env from a Secret/ConfigMap.
- [ ] **Step 3:** CI: lint (ruff, eslint), type-check (mypy, tsc), test (pytest, vitest), build images.
- [ ] **Step 4:** Deploy to dev namespace; `curl $APP_BASE_URL/healthz` → ok; SPA loads.
- [ ] **Step 5: Commit** `chore: containers, k8s dev deploy, CI pipeline`.

## Env vars used
`DATABASE_URL`, `LOG_LEVEL`, `CORS_ALLOWED_ORIGINS`, `APP_BASE_URL`, `BFF_BASE_URL`, container
registry + CI + cluster (inputs §5, §6).

## Exit / DoD
SPA loads at `APP_BASE_URL`, calls `/healthz` through the ingress, CI is green on a PR, and
`alembic upgrade head` runs in the deploy. No business logic yet — that's the point.
