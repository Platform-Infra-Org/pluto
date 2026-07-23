# E09 — Admin Dashboard & Cross-Cutting Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** A single **admin dashboard over everything**, plus production-readiness — auditor access,
resilience, observability, and accessibility. Draws from [../08-roadmap.md](../08-roadmap.md) Phase 6.

**Architecture:** The dashboard is a read/manage console composed from existing epics' data
(requests, services, workflows, RBAC, catalog, notifications, option sources) behind
`require_role("platform-admin")` — mostly aggregation APIs + admin actions, not a new subsystem. The
rest is additive: a read-only auditor role, reconciliation/idempotency guarantees, and OTel.

**Tech Stack:** OpenTelemetry (traces/metrics/logs), existing FastAPI/SPA, TanStack Table, axe for a11y.

## Global Constraints
Audit trail immutable; least-privilege; no secret leakage in logs. Admin dashboard is admin-only and
enforces authz server-side per panel. See README.

## File structure
- `apps/bff/app/api/admin/` — aggregation + management endpoints (overview, requests, services,
  workflows, rbac, ownership, option_sources, notifications)
- `apps/bff/app/api/audit.py` — auditor read views
- `apps/bff/app/obs/telemetry.py` — OTel setup
- `apps/bff/app/execution/reconcile.py` — startup reconciliation + stuck-workflow timeout
- `apps/web/src/app/admin/*` (dashboard shell + panels), `src/app/audit/*`
- tests under `tests/hardening/`, `tests/admin/`

---

### Task 1: Auditor role + audit views
**Interfaces:** `auditor` role → read-only access to requests, approvals, and `admin_bypass` events
across all teams; `GET /api/audit/requests`, `/api/audit/events`.
- [ ] Failing test (auditor reads all, mutates nothing → 403 on any write) → fail → implement → pass →
  commit `feat(hardening): auditor role + audit views`. (Policy P4 = in v1.)

### Task 2: Admin dashboard — aggregation APIs + management actions
**Files:** Create `app/api/admin/*.py`, `tests/admin/test_admin_api.py`
**Interfaces:** All `require_role("platform-admin")`. Produces:
- `GET /api/admin/overview` — counts/health tiles: requests by state, pending onboarding, workflow
  success rate, option-source staleness, invalid catalog files.
- `GET /api/admin/requests` — **all** requests/approvals across every team (filter by state/team/kind),
  incl. `admin_bypass` events.
- `GET /api/admin/services` — all Service Definitions + onboarding queue; approve/reject onboarding.
- `GET /api/admin/workflows` — recent workflow runs + failed steps (from E06).
- `GET /api/admin/rbac` — the `ROLE_GROUP_MAP` view; `GET/PUT /api/admin/ownership` — ownership map
  (change takes effect in routing).
- `GET /api/admin/option-sources` — poller health (last sync, stale, last error).
- [ ] **Step 1: Failing test** — non-admin gets 403 on every `/api/admin/*`; admin overview returns
  the expected tiles; editing the ownership map changes approval routing for a new request.
- [ ] Steps 2–4: implement aggregation over existing models/services; pass.
- [ ] Commit `feat(admin): dashboard aggregation apis + management actions`.

### Task 2b: Admin dashboard SPA
**Files:** Create `apps/web/src/app/admin/{shell,overview,requests,services,workflows,rbac,option-sources}.tsx`, tests
**Interfaces:** A dashboard shell (admin-only route guard) with panels bound to the Task 2 APIs —
overview tiles, cross-team request table, onboarding queue, workflow runs, RBAC/ownership views,
option-source health. Reuses TanStack Table + existing detail views (deep-links into request/status).
- [ ] Failing test (non-admin can't reach `/admin`; overview renders tiles; onboarding approve works
  from the dashboard) → fail → implement → pass → commit `feat(web): admin dashboard`.

### Task 3: Resilience — reconciliation, idempotency, timeouts
**Interfaces:** `reconcile_on_startup()` re-attaches watchers and reconciles in-flight requests via
`ArgoClient.get`; `request-id` idempotency verified end-to-end; a max-duration guard flips stuck
`EXECUTING` requests to `FAILED` with a clear message. **[D]**
- [ ] Failing test (BFF restart mid-workflow → request still reaches correct terminal state; stuck
  workflow → FAILED after timeout) → fail → implement → pass → commit `feat(hardening): resilience`.

### Task 4: Observability
**Interfaces:** OTel traces across request lifecycle + Argo watcher; metrics (requests by state,
approval latency, workflow success rate, poller health); structured logs with no secrets.
- [ ] Failing test (a request lifecycle emits the expected spans/metrics; secrets absent from logs) →
  fail → implement → pass → commit `feat(hardening): otel observability`.

### Task 5: Accessibility pass
**Interfaces:** Keyboard nav + ARIA on the data grids, forms, builder, and notification center; axe
checks in CI.
- [ ] Failing test (axe finds no critical violations on key routes; tab order sane) → fail → fix →
  pass → commit `feat(hardening): accessibility pass`.

## Env vars used
`LOG_LEVEL`, plus OTel exporter config (add `OTEL_EXPORTER_OTLP_ENDPOINT` if used).

## Blocks on inputs
P4 (auditor in v1?), P3 (bypass in prod), an OTel/observability backend endpoint if exporting.

## Exit / DoD
A **single admin dashboard** surfaces everything — all requests/approvals, services + onboarding,
workflow runs + failed steps, RBAC/ownership, option-source health, audit — and admin actions work
from it; auditors can review everything and change nothing; a BFF restart never loses a workflow's
outcome; the lifecycle is traced and metered; key screens pass axe.
