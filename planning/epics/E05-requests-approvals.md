# E05 — Requests & Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** Submit create/update/delete requests through schema-driven forms and route them through a
governed approval lifecycle whose policy is **per-resource and data-driven** — `SINGLE`,
`N_OF_M(n)`, or `RBAC` — with **audit-logged admin bypass**. Execution (Argo) is wired in E06; this
epic stops at `APPROVED`.

**Architecture:** A `Request` row + append-only `RequestEvent` audit trail driving an explicit state
machine. Approver authorization derives from the caller's teams (E02 `groups`). The `kind` field
selects the approver rule; this epic implements the `RESOURCE_CHANGE` lane (the `SERVICE_ONBOARDING`
lane is E08, same machine). **[decided]** (See [../05-approvals.md](../05-approvals.md).)

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic (payload validation vs. type schema), TanStack (forms/queues).

## Global Constraints
Server-side authz on every transition; requester ≠ own approver (except `RBAC` auto-approve); bypass
always logged. Policy is resolved per-resource, never hardcoded; resource types are dynamic.

## File structure
- `apps/bff/app/models/request.py` — `Request`, `RequestEvent`
- `apps/bff/app/requests/state.py` — transitions + guards (policy-satisfied, staleness)
- `apps/bff/app/requests/policy.py` — resolve + evaluate `approval_policy` (SINGLE/N_OF_M/RBAC)
- `apps/bff/app/requests/authz.py` — approver resolution (`RESOURCE_CHANGE`)
- `apps/bff/app/requests/schema_forms.py` — validate payload against type schema
- `apps/bff/app/api/requests.py` — submit/list/get/approve/reject/bypass endpoints
- `apps/web/src/app/routes/requests/*` — request form, my-requests, approval queue, detail
- tests under `tests/requests/`

---

### Task 1: Models + audit trail + migration
**Files:** Create `app/models/request.py`, migration, `tests/requests/test_model.py`
**Interfaces:** Produces `Request(id, kind, action, resource_type, resource_id, owner_team, payload,
requester, state, approval_policy:jsonb {mode, n?}, approvals:jsonb, workflow_ref, base_git_sha,
created_at, updated_at)` and `RequestEvent(request_id, at, actor, from_state, to_state, note, flags)`.
- [ ] Failing test (create request + event round-trip) → fail → implement+migrate → pass → commit
  `feat(requests): request + audit models`.

### Task 2a: Policy resolution + evaluation engine (core)
**Files:** Create `app/requests/policy.py`, `tests/requests/test_policy.py`
**Interfaces:** Produces
- `resolve_policy(resource_payload, definition) -> ApprovalPolicy` — resource `metadata.approvalPolicy`
  override → Service Definition default. (Definition comes from E08; until then a config lookup.)
- `is_satisfied(policy, approvals, requester_can_approve: bool) -> bool` — `SINGLE`: ≥1 distinct
  approver; `N_OF_M`: ≥`n` distinct; `RBAC`: satisfied by any single authorized approval, and
  auto-satisfiable when `requester_can_approve` (self-service — the confirm-flag default). **[decided]**
- [ ] **Step 1: Failing test**
```python
def test_single_needs_one():
    assert not is_satisfied(P("SINGLE"), [], False)
    assert is_satisfied(P("SINGLE"), ["alice"], False)
def test_n_of_m_needs_distinct():
    assert not is_satisfied(P("N_OF_M", n=2), ["alice","alice"], False)
    assert is_satisfied(P("N_OF_M", n=2), ["alice","bob"], False)
def test_rbac_auto_approves_permitted_requester():
    assert is_satisfied(P("RBAC"), [], requester_can_approve=True)   # self-service
    assert not is_satisfied(P("RBAC"), [], requester_can_approve=False)
def test_resolve_prefers_resource_override():
    assert resolve_policy({"metadata":{"approvalPolicy":{"mode":"RBAC"}}}, def_single).mode == "RBAC"
```
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(requests): approval policy engine`.

### Task 2b: State machine (legal edges + policy-satisfied guard)
**Files:** Create `app/requests/state.py`, `tests/requests/test_state.py`
**Interfaces:** Produces `transition(req, action, actor, note) -> Request` enforcing legal edges
(DRAFT→PENDING_APPROVAL→APPROVED/REJECTED, etc.); `add_approval(req, approver)` appends a distinct
approver and fires `APPROVED` when `is_satisfied(...)` (Task 2a); every transition writes a
`RequestEvent`.
- [ ] **Step 1: Failing test**
```python
def test_approval_fires_when_policy_satisfied():
    r = make_request(policy=P("SINGLE"))
    add_approval(r, "alice"); assert r.state == "APPROVED"
def test_illegal_transition_raises():
    with pytest.raises(IllegalTransition): transition(make_request(state="SUCCEEDED"),"approve","x",None)
```
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(requests): state machine + policy-satisfied guard`.

### Task 3: Approver authorization + separation of duties + admin bypass
**Files:** Create `app/requests/authz.py`, `tests/requests/test_authz.py`
**Interfaces:** Produces `can_approve(principal, req) -> bool` — depends on `req.approval_policy.mode`:
for `SINGLE`/`N_OF_M`, member of `req.owner_team` OR `platform-admin`, never the requester; for
`RBAC`, any principal whose RBAC grants approve on the resource (may include the requester →
self-service). Also `admin_bypass(req, admin, reason)` → `APPROVED` with a
`RequestEvent(flags=["admin_bypass"], note=reason)`. **[decided]**
- [ ] **Step 1: Failing test** — owner-team member can approve a SINGLE request; outsider 403;
  requester can't self-approve a SINGLE/N_OF_M request; RBAC-permitted requester *can* self-approve
  an RBAC request; admin bypass approves and writes an `admin_bypass` event with a required reason.
- [ ] Steps 2–4: implement. [ ] Commit `feat(requests): approver authz + admin bypass`.

### Task 4: Payload validation + staleness guard
**Files:** Create `app/requests/schema_forms.py`, `tests/requests/test_schema.py`
**Interfaces:** Produces `validate_payload(resource_type, action, payload)` against the type's JSON
Schema; `is_stale(req)` true if the resource's current `git_sha` != `req.base_git_sha`.
- [ ] Failing test (invalid payload rejected; stale detected) → fail → implement → pass → commit
  `feat(requests): payload validation + staleness`.

### Task 5: Request API
**Files:** Create `app/api/requests.py`, `tests/requests/test_api.py`
**Interfaces:** Produces `POST /api/requests`, `GET /api/requests?mine|queue`, `GET /api/requests/{id}`,
`POST /api/requests/{id}/approve|reject`, `POST /api/requests/{id}/bypass` (admin). All authz via
E02 + Task 3. `queue` returns requests for teams the caller approves for.
- [ ] Failing test (submit→appears in owner queue→approve reaches APPROVED; wrong user 403) → fail →
  implement → pass → commit `feat(requests): request api`.

### Task 6: SPA — request form, my-requests, approval queue, detail
**Files:** Create `src/app/routes/requests/{form,mine,queue,detail}.tsx`, tests
**Interfaces:** Schema-driven form (renders type JSON Schema via the shared headless renderer —
shared with E08); my-requests with live state; approval queue with **diff (current vs proposed)** +
approve/reject + note; detail with audit history.
- [ ] Failing test (form validates required field; queue approve button hidden for non-approver) →
  fail → implement → pass → commit `feat(web): request form + approval queue`.

## Env vars used
None new (uses E02/E04). Policy is data-driven per resource/definition — nothing hardcoded.

## Blocks on inputs
None hard. Confirm the `RBAC`-mode self-approve semantics (default: permitted requester
auto-approves). Admin bypass is **enabled in prod** (decided). Auditor role is **in v1** (decided).

## Exit / DoD
A requester submits an update; a `SINGLE`-policy resource needs one owner approval; an `N_OF_M(2)`
resource needs two distinct approvers; an `RBAC` resource auto-approves for a permitted requester (or
needs one RBAC-permitted approver); an admin can bypass with a logged reason; the full audit trail is
visible. Policy is read per-resource, never hardcoded. No Argo yet — that's E06.
