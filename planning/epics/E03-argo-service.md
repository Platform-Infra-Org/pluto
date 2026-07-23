# E03 — Argo Integration Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** A BFF module that can submit an Argo workflow, watch it to completion, and — on failure —
report **exactly which step failed** and why. This is the highest-risk integration; build it in
isolation against a real Argo before wiring it to approvals (E06).

**Architecture:** An `ArgoClient` wraps the Argo REST API (submit, get, watch-events). A
`WorkflowStatus` mapper turns `status.nodes` into a normalized tree and extracts the deepest failed
node. All facts here are research-verified against primary Argo docs. **[R]** (See
[../06-argo-integration.md](../06-argo-integration.md), [../09-research-findings.md](../09-research-findings.md).)

**Tech Stack:** FastAPI/httpx (async REST) — or the `argo-workflows` Python client / Hera; bearer
token auth (`--auth-mode client`).

## Global Constraints
Workflow is the sole Git writer (templates do that; this epic just triggers/observes). Secrets from env.

## File structure
- `apps/bff/app/argo/client.py` — `ArgoClient` (submit/get/watch)
- `apps/bff/app/argo/status.py` — `normalize_status`, `find_failed_step`
- `apps/bff/app/argo/models.py` — `WorkflowRef`, `WorkflowStatus`, `NodeStatus`
- `tests/argo/test_status.py`, `tests/argo/test_client.py`, `tests/argo/fixtures/*.json`

---

### Task 1: Status models + failed-step extraction (pure, no network)

**Files:** Create `app/argo/models.py`, `app/argo/status.py`, `tests/argo/test_status.py` +
fixture JSONs captured from real workflows (one succeeded, one failed mid-DAG).

**Interfaces:**
- Produces:
  - `NodeStatus(id, name, display_name, type, phase, message, children: list[str])`
  - `WorkflowStatus(name, phase, nodes: dict[str, NodeStatus])`
  - `normalize_status(raw: dict) -> WorkflowStatus`
  - `find_failed_step(ws: WorkflowStatus) -> NodeStatus | None` — deepest leaf node with
    phase in {`Failed`,`Error`}. **[R]**

- [ ] **Step 1: Failing test**
```python
def test_find_failed_step_returns_leaf():
    ws = normalize_status(load_fixture("failed_dag.json"))
    failed = find_failed_step(ws)
    assert failed.display_name == "deploy-db"        # the actual failing step
    assert "exit code 1" in failed.message
def test_succeeded_has_no_failed_step():
    assert find_failed_step(normalize_status(load_fixture("succeeded.json"))) is None
def test_pending_phase_missing_is_treated_pending():
    ws = normalize_status({"metadata":{"name":"w"},"status":{}})  # no status.phase [R caveat]
    assert ws.phase == "Pending"
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** parsing of `status.nodes`, phase defaulting (missing → `Pending`), and
  the deepest-failed-leaf walk.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(argo): status model + failed-step extraction`.

### Task 2: ArgoClient — submit + get (against real Argo)

**Files:** Create `app/argo/client.py`, `tests/argo/test_client.py`

**Interfaces:**
- Produces:
  - `async submit(template: str, parameters: dict[str,str], labels: dict) -> WorkflowRef`
    → `POST /api/v1/workflows/{ns}/submit` (body wraps under top-level object). **[R caveat]**
  - `async get(ref: WorkflowRef) -> WorkflowStatus` → `GET /api/v1/workflows/{ns}/{name}`.
  - Auth header `Authorization: Bearer {ARGO_AUTH_TOKEN}`; base `ARGO_SERVER_URL`; ns `ARGO_NAMESPACE`.

- [ ] **Step 1: Failing test** (integration, gated by env) — submit a known template with a param,
  poll `get` until terminal, assert `Succeeded`. Plus a unit test with a mocked httpx transport for
  the request shape (URL, wrapped body, bearer header).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with httpx AsyncClient; idempotency label `request-id` on submit.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(argo): submit + get client`.

### Task 3: Watch stream + failed-step end-to-end proof

**Files:** Modify `app/argo/client.py` (add `watch`), `tests/argo/test_watch.py`

**Interfaces:**
- Produces: `async watch(ref) -> AsyncIterator[WorkflowStatus]` → consumes
  `GET /api/v1/workflow-events/{ns}` (SSE), yields normalized status on each event; auto-reconnect +
  `get` reconciliation on drop. **[R]**

- [ ] **Step 1: Failing test** (integration) — submit a **deliberately-failing** template, `watch`
  to terminal, assert final phase `Failed` and `find_failed_step().display_name` == the known bad
  step. This proves requirement (6).
- [ ] **Step 2–4:** implement stream consumption + reconnect; test passes against real Argo.
- [ ] **Step 5: Commit** `feat(argo): watch stream + proven failed-step reporting`.

## Env vars used
`ARGO_SERVER_URL`, `ARGO_NAMESPACE`, `ARGO_AUTH_TOKEN`, `ARGO_VERIFY_TLS` (inputs §2).

## Blocks on inputs
§2: reachable Argo, a reference WorkflowTemplate (incl. one that fails on purpose), SA RBAC to
submit/watch.

## Exit / DoD
Against a real Argo: submit succeeds, watch reports live phases, and a failing workflow yields the
exact failed step name + message. Pure status logic is unit-tested from fixtures.
