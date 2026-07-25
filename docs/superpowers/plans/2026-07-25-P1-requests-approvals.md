# P1 — Requests Backend + Approvals Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or execute inline
> with TDD. Steps use `- [ ]` checkboxes. Backstage plugin work; test with the plugin
> test harness + the running stack.

**Goal:** A `platform-requests` backend plugin (own knex DB) implementing the request
state machine + approval policies + RBAC, and a `platform-requests` frontend plugin
(queue, request detail, approve/reject) — so requests can be created, listed,
approved/rejected with role gating, all inside Backstage.

**Architecture:** New backend system plugin (`createBackendPlugin`) with a knex-backed
store and an HTTP router; a Backstage permission policy mapping Keycloak roles →
permissions; a new frontend-system plugin with a nav item + pages. The Argo submit on
approval is stubbed here (a no-op that advances to IN_PROGRESS) and wired for real in P2.

**Tech Stack:** Backstage backend/frontend plugin APIs, knex, TypeScript, Jest (Backstage test utils).

## Global Constraints

- Branch `backstage-plugins`; never modify `apps/`.
- Plugins under `backstage/plugins/`; shared types in `backstage/plugins/platform-common`.
- Reuse the state machine semantics from the legacy BFF: states
  `PENDING_APPROVAL → APPROVED → IN_PROGRESS → SUCCEEDED|FAILED`, `REJECTED` from pending;
  policies `SINGLE`, `N_OF_M`, `RBAC`; no self-approval.
- Roles come from the Keycloak `groups` claim already flowing through OIDC:
  `platform-admins→platform-admin`, `platform-auditors→auditor`, `service-owner→service-owner`,
  `owners-payments→team payments`. Map these to Backstage permissions.
- All new code TypeScript; each task ends green (plugin tests) before commit.

---

## Task 1: Scaffold platform-common + platform-requests-backend packages

**Files:**
- Create `backstage/plugins/platform-common/` (package.json, src/index.ts, types).
- Create `backstage/plugins/platform-requests-backend/` (package.json, src/index.ts, src/plugin.ts).

**Interfaces:**
- Produces: `Request`, `RequestState`, `ApprovalPolicy`, `Approval` types (platform-common);
  a backend plugin `platformRequestsPlugin` registered in the backend.

- [ ] Define shared types in platform-common:
```ts
export type RequestState =
  | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_PROGRESS'
  | 'SUCCEEDED' | 'FAILED' | 'REJECTED';
export type RequestKind = 'CREATE' | 'UPDATE' | 'DELETE';
export type ApprovalPolicy =
  | { mode: 'SINGLE' }
  | { mode: 'N_OF_M'; n: number }
  | { mode: 'RBAC'; role: string };
export interface Approval { approver: string; decision: 'approve' | 'reject'; note?: string; at: string; }
export interface Request {
  id: number; kind: RequestKind; resourceType: string; resourceName: string;
  params: Record<string, unknown>; state: RequestState; policy: ApprovalPolicy;
  requester: string; approvals: Approval[];
  workflowName?: string; workflowPhase?: string; error?: string;
  createdAt: string; updatedAt: string;
}
```
- [ ] Scaffold the backend plugin skeleton (`createBackendPlugin({ pluginId: 'platform-requests' })`)
  with an empty router registered via `httpRouter`.
- [ ] Add both packages to the workspace; `yarn install`; `yarn tsc` clean.
- [ ] Register the plugin in `packages/backend/src/index.ts` and confirm the backend boots.
- [ ] Commit: `feat(requests): scaffold platform-common + requests-backend plugin`.

## Task 2: knex store + migration

**Files:**
- Create `backstage/plugins/platform-requests-backend/migrations/0001_init.js`.
- Create `.../src/store.ts`, `.../src/store.test.ts`.

**Interfaces:**
- Produces: `RequestsStore` with `create`, `get`, `list`, `addApproval`, `setState`,
  `setWorkflow` methods returning `Request`.

- [ ] Migration creating `requests` and `approvals` tables (columns per the Request type;
  params/policy as json/text).
- [ ] Write `store.test.ts` (using `TestDatabases` from `@backstage/backend-test-utils`):
  create → get round-trips; list filters by state/requester; addApproval appends.
- [ ] Run: `yarn workspace @internal/plugin-platform-requests-backend test store` — expect FAIL.
- [ ] Implement `store.ts` (knex CRUD, runs migrations on init).
- [ ] Run tests — expect PASS.
- [ ] Commit: `feat(requests): knex store + migration`.

## Task 3: State machine + approval policies

**Files:** Create `.../src/stateMachine.ts`, `.../src/stateMachine.test.ts`.

**Interfaces:**
- Produces: `applyApproval(request, approver, decision, note, isPrivileged) -> Request`
  and `canTransition(...)`; `policySatisfied(policy, approvals) -> boolean`.

- [ ] Tests: SINGLE needs 1 approve; N_OF_M needs n; RBAC needs an approver with the role;
  no self-approval (requester cannot approve own); reject from PENDING → REJECTED; approve
  when satisfied → APPROVED; illegal transitions throw.
- [ ] Run tests — FAIL.
- [ ] Implement the pure state machine (ported from the legacy `requests/state.py` semantics).
- [ ] Run tests — PASS.
- [ ] Commit: `feat(requests): state machine + approval policies`.

## Task 4: RBAC permission policy

**Files:**
- Create `backstage/plugins/platform-permission-backend/` (or a backend module) with a
  `PermissionPolicy`.
- Define permissions in platform-common: `platform.request.create`, `platform.request.approve`,
  `platform.request.read`.

**Interfaces:**
- Consumes: the identity's ownership/roles (from the `groups` claim via the catalog/identity).
- Produces: a `PermissionPolicy` registered in the backend that allows/denies by role.

- [ ] Map roles → permission decisions: requester+ can create; platform-admin can approve;
  everyone authenticated can read; auditor read-only.
- [ ] Test the policy with synthetic identities (has role vs not) → ALLOW/DENY.
- [ ] Register the policy (replaces `allow-all-policy` in `packages/backend/src/index.ts`).
- [ ] Commit: `feat(requests): RBAC permission policy`.

## Task 5: HTTP router + service wiring

**Files:** Create `.../src/router.ts`, `.../src/router.test.ts`; update `.../src/plugin.ts`.

**Interfaces:**
- Consumes: `RequestsStore`, state machine, permissions service, httpAuth.
- Produces: REST — `POST /requests`, `GET /requests`, `GET /requests/:id`,
  `POST /requests/:id/approve`, `POST /requests/:id/reject`. On reaching APPROVED, calls a
  `submitWorkflow(request)` hook (stubbed here to set IN_PROGRESS; real Argo in P2).

- [ ] Router tests (`startTestBackend` or supertest with a mocked store + permissions):
  create returns 201 + PENDING; approve by a non-approver → 403; approve by admin →
  APPROVED then IN_PROGRESS (stub); reject → REJECTED; read enforced.
- [ ] Run — FAIL.
- [ ] Implement the router (permission checks via the permissions service; auth via httpAuth).
- [ ] Run — PASS.
- [ ] Live check against the running backend: create + approve a request over HTTP with the
  static token; observe state transitions in Postgres.
- [ ] Commit: `feat(requests): REST router + approval submit hook`.

## Task 6: Frontend plugin — request queue + detail + approve/reject

**Files:** Create `backstage/plugins/platform-requests/` (new frontend-system plugin):
`src/plugin.tsx`, `src/api.ts`, `src/components/RequestsPage.tsx`, `src/components/RequestPage.tsx`.

**Interfaces:**
- Consumes: the backend REST via a typed client (discoveryApi + fetchApi).
- Produces: a nav item "Requests" + pages at `/requests` and `/requests/:id`.

- [ ] API client: list/get/approve/reject.
- [ ] `RequestsPage`: a table of requests (state chips, requester, type). Component test with a
  mocked api renders rows.
- [ ] `RequestPage`: detail + approve/reject buttons (shown per permission). Component test:
  approve calls the api; buttons hidden without permission.
- [ ] Register the plugin + nav item in `packages/app/src/App.tsx` (features) and the nav module.
- [ ] Run frontend tests — PASS; `yarn tsc` clean.
- [ ] Live check: sign in, open Requests, see a seeded request, approve it.
- [ ] Commit: `feat(requests): frontend queue + detail + approvals`.

## Task 7: Seed a demo request + end-to-end check

**Files:** Extend `deploy/backstage/` with a small script that POSTs a demo request (or a
backend dev-seed), and document it.

- [ ] Add a `deploy/backstage/seed-request.sh` that creates one PENDING request via REST.
- [ ] Verify: request appears in the UI queue; admin approves; state → IN_PROGRESS (stub);
  requester cannot approve their own.
- [ ] Commit: `feat(requests): demo request seed + e2e check`.

---

## Self-Review

- **Spec coverage (design §5, §7, §8):** state machine + policies (T3), data model (T2),
  RBAC (T4), REST (T5), UI (T6). The APPROVED→IN_PROGRESS Argo submit is stubbed here and
  completed in P2 — noted in T5.
- **Type consistency:** `Request`/`ApprovalPolicy`/`RequestState` defined once in
  platform-common (T1) and consumed everywhere.
- **Sequencing:** types → store → logic → policy → router → UI → e2e. Each task independently
  testable and committed.
