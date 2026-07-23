# 08 — Roadmap

Phased so each phase ships something usable and de-risks the next. Estimates are rough **[D]** and
assume a small team (≈2–3 devs). Sequence matters more than the numbers.

## Phase 0 — Foundations (spike + skeleton)

**Goal: prove the two hardest integrations early.**

- [ ] Keycloak realm + OIDC/PKCE login working end-to-end (SPA → Keycloak → BFF JWT validation). **[R]**
- [ ] AD/LDAP federation into Keycloak, `groups` claim reaching the BFF. **[R]**
- [ ] BFF ↔ Argo: submit a trivial WorkflowTemplate via REST, watch `/workflow-events`, read
      `status.nodes`. Prove the failed-step read works with a deliberately-failing template. **[R]**
- [ ] Repo scaffold: Vite SPA + Python/FastAPI BFF + Postgres, CI, containerized, deploys to the cluster.

*Exit:* a logged-in user can click a button that runs a hello-world workflow and sees it
succeed/fail with the failing step. This proves auth + Argo — everything else is product on top.

## Phase 1 — Catalog (read)

**Goal: users see their resources.**

- [ ] Git sync worker: pull repo, parse/validate JSON, index into Postgres. **[D]**
- [ ] Resource-type schemas defined; ownership resolution (metadata → map → default). **[D]**
- [ ] "My resources" grid + resource detail (parsed fields, raw JSON, Git history). **[D]**
- [ ] RBAC visibility enforced in BFF queries. **[R for mechanism]**

*Exit:* users browse the catalog filtered by their team/roles.

## Phase 2 — Requests & approvals

**Goal: governed change, without execution yet.**

- [ ] Request entity (incl. resolved `approval_policy`, `approvals[]`) + state machine + audit history. **[D]**
- [ ] Schema-driven request forms (create/update/delete). **[D]**
- [ ] Approval queue; owner-team-based authorization (`groups` claim); **per-resource policy engine
      (SINGLE / N_OF_M / RBAC) + admin bypass (audit-logged)**. **[R for mechanism / decided for policy]**
- [ ] Staleness/concurrency guards. **[D]**

*Exit:* a request can be submitted and approved/rejected (approval doesn't trigger Argo yet — or
triggers a no-op template).

## Phase 3 — Execution + live status

**Goal: approval actually changes the resource.**

- [ ] On approval (per the resolved approval policy), submit the real Argo Workflow with request
      payload as parameters. **[R]**
- [ ] **Workflow commits resource JSON back to Git (sole writer); UI only reads.** Sync worker
      re-indexes on the resulting push. **[decided]**
- [ ] Live workflow status view (node tree from `status.nodes`), failed-step surfaced + stored. **[R]**
- [ ] Request → SUCCEEDED/FAILED transitions driven by Argo events. **[R]**

*Exit:* full loop — request → approve → workflow → Git updated → user sees success or failed step.

## Phase 4 — Notifications

**Goal: users don't have to poll the UI.**

- [ ] Notification model + persistence. **[D]**
- [ ] SSE channel (shared with status); notification bell + page; read state. **[R for SSE]**
- [ ] Events wired: approval-needed, approved/rejected, workflow done/failed. **[D]**
- [ ] Multi-replica fan-out via Postgres LISTEN/NOTIFY. **[D]**

*Exit:* approvers are notified of pending requests; requesters of outcomes.

## Phase 5 — Service Request Builder & onboarding

**Goal: service owners self-serve their forms; admins gatekeep onboarding.** (Until here, service
schemas are hand-authored JSON; this phase makes them self-service.) See
[10](10-service-request-builder.md).

- [ ] Service Definition model (form JSON Schema + ui-schema + workflow binding + `approval_policy`). **[D]**
- [ ] Visual form builder (headless fields, per-field settings, workflow-binding panel) with **live
      preview using the real request-form renderer**. **[D]**
- [ ] **Server-backed field types:** groups picker (Keycloak/LDAP, scoped), file upload (→ **Argo
      artifact repository**, reference in payload), dynamic choice box (**BFF option-source poller**,
      configurable refresh interval **≥60s**, cached + last-good on failure). **[D]**
- [ ] **Pin-until-migrated** versioning: resources record their definition version; explicit
      migrate action. **[D]**
- [ ] `SERVICE_ONBOARDING` request kind; **admin** onboarding queue + approve/reject. **[D]**
- [ ] On approval, workflow commits the Service Definition JSON to Git → catalog indexes → `ACTIVE`. **[D]**
- [ ] `service-owner` RBAC capability; draft-in-Postgres until submitted. **[D]**

*Exit:* a service owner builds a form, an admin approves it, and it becomes requestable in the
catalog — no code change.

## Phase 6 — Admin dashboard & hardening

- [ ] **Admin dashboard over everything** — a single console: all requests/approvals across teams,
      services + onboarding queue, workflow runs + failed steps, RBAC/role-group map, ownership map,
      option-source health, notifications overview, audit. **[decided]**
- [ ] Auditor role (v1) + audit views; separation-of-duties enforcement. **[decided]**
- [ ] Observability: metrics/traces/logs on the request lifecycle + Argo watcher.
- [ ] Resilience: BFF-restart reconciliation, idempotent submits, stuck-workflow timeouts. **[D]**
- [ ] Accessibility pass (keyboard nav, ARIA on the data grids and forms).

## Critical path / risks

1. **Auth first (Phase 0)** — AD/LDAP + Keycloak + `groups` claim is the highest-uncertainty piece;
   prove it before building product.
2. **Argo failed-step reporting (Phase 0)** — verify `status.nodes` gives the granularity the
   requirement demands on a real failing template.
3. **Ownership alignment** — resource `owner_team` strings must match Keycloak/AD groups, or
   approval routing breaks. Nail this convention in Phase 1.

## Decided
- **Frontend:** headless — shadcn/ui + Tailwind + TanStack Table.
- **Service builder:** visual builder → JSON Schema Service Definitions; onboarding approved by
  admins; sole Git writer remains the workflow.
- **Git write-back:** the Argo Workflow is the sole writer to Git; the UI only reads.
- **Approval policy:** per-resource, data-driven — `SINGLE` / `N_OF_M(n)` / `RBAC` — on the Service
  Definition, overridable per resource (dynamic types, not hardcoded); `platform-admin` bypass,
  always audit-logged (prod). Retire-with-live-resources **blocked**; auditor role **in v1**.
- **Admin dashboard:** one console over everything (see Phase 6).
- **Backend:** Python/FastAPI — platform team is Python-first and owns the BFF (Hera/`argo-workflows`
  + K8s Python clients; TS types generated from FastAPI's OpenAPI). Go only if high streaming
  concurrency ever justifies the second language.

## Decisions still to confirm before Phase 0
- `RBAC` approval mode: may a permitted requester auto-approve their own request, or must a
  different RBAC-permitted principal approve? (Default assumed: auto-approve if permitted.)
