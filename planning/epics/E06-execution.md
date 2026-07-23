# E06 — Execution Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** Close the loop — when a request reaches `APPROVED`, submit the bound Argo workflow, track
it live, transition the request to `SUCCEEDED`/`FAILED` (storing the failed step), and re-index Git
after the workflow commits the change.

**Architecture:** An `Executor` reacts to `APPROVED` (E05) by resolving the resource-type's workflow
binding, mapping payload → parameters, and calling `ArgoClient.submit` (E03). An `ArgoWatcher`
background task streams status, maps phase → request state, and persists the failed step. The
**workflow commits to Git**; the E04 sync worker re-indexes. **[R]/[decided]**

**Tech Stack:** E03 `ArgoClient`, E05 state machine, FastAPI background tasks, SSE (shared channel
lands in E07; E06 exposes a status endpoint).

## Global Constraints
Workflow is the sole Git writer. Idempotent submit (request-id label). Server-side authz. See README.

## File structure
- `apps/bff/app/execution/binding.py` — workflow binding + param mapping
- `apps/bff/app/execution/executor.py` — APPROVED → submit
- `apps/bff/app/execution/watcher.py` — watch → state transitions + failed-step persist
- `apps/bff/app/api/workflow_status.py` — `GET /api/requests/{id}/status`
- `apps/web/src/app/routes/requests/status.tsx` — live node tree + failed step
- tests under `tests/execution/`

---

### Task 1: Workflow binding + parameter mapping
**Files:** Create `app/execution/binding.py`, `tests/execution/test_binding.py`
**Interfaces:** Produces `resolve_binding(resource_type, action) -> Binding(template_ref, param_map)`
and `map_params(payload, param_map) -> dict[str,str]`. (Binding comes from the service definition —
E08; until then a static config.) **[D]**
- [ ] Failing test (payload fields map to declared workflow params; missing required param errors) →
  fail → implement → pass → commit `feat(exec): workflow binding + param map`.

### Task 2: Executor — APPROVED triggers submit (idempotent)
**Files:** Create `app/execution/executor.py`, `tests/execution/test_executor.py`
**Interfaces:** Produces `async on_approved(req) -> Request` → submit via `ArgoClient`, store
`workflow_ref`, transition `APPROVED→EXECUTING`; idempotent via `request-id` label (re-run doesn't
double-submit). **[R]**
- [ ] **Step 1: Failing test** (ArgoClient mocked) — on_approved submits with mapped params + the
  request-id label, sets `workflow_ref`, state `EXECUTING`; calling twice submits once.
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(exec): approved→submit executor`.

### Task 3: Watcher — status → state + failed-step persistence
**Files:** Create `app/execution/watcher.py`, `tests/execution/test_watcher.py`
**Interfaces:** Produces `async watch_request(req)` consuming `ArgoClient.watch`; maps Succeeded→
`SUCCEEDED`, Failed/Error→`FAILED` and persists `find_failed_step()` (name+message+phase) on the
request; reconciles via `get` on reconnect / BFF restart. **[R]**
- [ ] **Step 1: Failing test** — a failing workflow drives request to `FAILED` with the exact failed
  step stored; a succeeding one to `SUCCEEDED`; restart mid-run reconciles to terminal state.
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(exec): watcher + failed-step persistence`.

### Task 4: Re-index after Git write
**Files:** Modify watcher to call E04 `sync_repo` (or rely on webhook) on `SUCCEEDED`;
`tests/execution/test_reindex.py`
- [ ] Failing test (after SUCCEEDED, catalog index reflects the workflow's committed change) → fail →
  implement → pass → commit `feat(exec): reindex on success`.

### Task 5: Status API + SPA live view
**Files:** Create `app/api/workflow_status.py`, `src/app/routes/requests/status.tsx`, tests
**Interfaces:** Produces `GET /api/requests/{id}/status` → normalized node tree + current phase +
failed step; SPA renders a **step/node tree**, highlights the failed step with its message. (Live
push is wired to SSE in E07; here poll or basic stream.)
- [ ] Failing test (status endpoint returns tree; failed step highlighted in UI) → fail → implement →
  pass → commit `feat(exec): status api + live node tree`.

## Env vars used
Uses E03 (`ARGO_*`) and E04 (`GIT_*`). No new vars.

## Blocks on inputs
§2 WorkflowTemplates + parameter contract; §3 workflow's own Git write credential + commit identity.

## Exit / DoD
End-to-end: request → approve → workflow runs → resource JSON committed to Git → catalog re-indexed →
request `SUCCEEDED`; a failing workflow yields `FAILED` with the exact failed step shown to the user.
