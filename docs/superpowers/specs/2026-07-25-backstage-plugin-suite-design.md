# Platform → Backstage Plugin Suite — Design

**Status:** approved-pending-review
**Branch:** `backstage-plugins` (current `apps/web` + `apps/bff` kept intact for fallback)
**Date:** 2026-07-25

## 1. Goal

Turn the current bespoke internal developer platform (React SPA + FastAPI BFF)
into a **suite of Backstage plugins** running inside a **readymade, self-contained
Backstage instance** we can boot and test locally. Preserve the modern design and
the request-management / approval model; turn the composable graph builder into a
tool that **authors Backstage Scaffolder software templates**; add resource
edit/delete; and surface **live Argo workflow status inside Backstage**, keeping a
request "in progress" until its workflow actually finishes.

Everything moves to TypeScript.

## 2. Confirmed decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Backend strategy | **Native Backstage backend plugins** (full TS rewrite; each with its own knex DB) |
| 2 | Graph builder output | **A Scaffolder `template.yaml`** (params form + submit step) committed to the templates repo, alongside the Argo `WorkflowTemplate` |
| 3 | Resource edit/delete | **Through the approval flow**, then the workflow updates git |
| 4 | Argo trigger | **Argo REST API submit**, correlate via label/annotation |
| 5 | Approval placement | **Scaffolder run creates a Request; Argo is gated on approval; request tracks the workflow to done** |
| 6 | Git host | **Local Gitea** in the docker stack (config-swappable to GitHub/GitLab) |
| 7 | Argo runtime | **Real Argo on a local kind cluster**, seeded WorkflowTemplates that actually run |
| 8 | Auth | **Keycloak (OIDC)**, preserve current RBAC roles/groups |
| 9 | Catalog repo writes | **The Argo workflow handles the repo** — our backend never commits catalog-info.yaml |
| 10 | Notifications | **Reuse Backstage's native notifications system** |
| 11 | Theme | **Custom Backstage theme approximating the current look** (palette + light/dark + color schemes) |

## 3. What we are porting (current system recap)

The existing FastAPI BFF + React SPA provide: Keycloak OIDC + group→role RBAC
(platform-admin, service-owner, auditor, requester); a request/approval state
machine with SINGLE / N_OF_M / RBAC policies and an audit trail; a resource
catalog indexed from `catalog-info`-style JSON in git, with a dependency graph
(resources linked by a per-type `id_field` dot-path); a composable **graph
builder** where service owners wire typed **function blocks** into per-verb
graphs (create/update/delete) that a **pure generator** compiles into an Argo
`WorkflowTemplate` + a `build-json.j2` runtime template (golden-file tested);
onboarding of new service types via admin approval; notifications.

All of this is re-expressed as Backstage plugins. The generator and state machine
are the two pieces of real logic to port; the rest is UI + wiring.

## 4. Target architecture

### 4.1 Monorepo layout

```
backstage/                     # @backstage/create-app output (new backend system)
  packages/app/                # Backstage frontend app (custom theme, plugin wiring)
  packages/backend/            # Backstage backend (plugin wiring)
  plugins/
    platform-requests/         # FE: request queue, approvals, request detail + status
    platform-requests-backend/ # BE: request state machine, approvals, service_definitions (knex DB)
    platform-builder/          # FE: React Flow graph builder → Scaffolder template authoring
    platform-builder-backend/  # BE: TS generator (graph→WorkflowTemplate + template.yaml), Gitea write to templates repo
    platform-catalog/          # FE: resource form/raw/dependency-graph views + edit/delete actions
    platform-argo/             # FE: Argo workflow status tab + DAG view
    platform-argo-backend/     # BE: Argo REST client, label-based status polling, completion gating
    platform-scaffolder-actions/ # BE: custom Scaffolder actions (platform:request:submit, …)
    platform-common/           # shared TS types (Request, ServiceDefinition, graph JSON, generator vectors)
apps/                          # UNCHANGED — legacy SPA + BFF, fallback only
deploy/, scripts/              # extended with the readymade Backstage stack
```

Legacy `apps/` stays; nothing in it is modified on this branch.

### 4.2 Reused Backstage core

- **Catalog** — resources are `Resource`/`Component` entities from `catalog-info.yaml`
  in the Gitea catalog repo, ingested by a `GitlabDiscovery`/`GithubDiscovery`-style
  provider (Gitea speaks the GitHub API well enough; if not, a `url` location per
  repo + a periodic refresh).
- **Scaffolder** — software templates are `template.yaml` entities from the Gitea
  templates repo, shown on the **Create** page.
- **Auth** — Keycloak OIDC provider; resolve Backstage identity from Keycloak, map
  groups → Backstage `group:` entities.
- **Permissions** — a custom permission policy maps roles → permissions.
- **Notifications** — the core notifications system (bell UI + backend).

## 5. Core flow (the spine)

### 5.1 Create a resource

1. User opens **Create** → picks a software template (authored earlier by the graph
   builder, committed to the templates repo, discovered by Scaffolder).
2. Fills the parameter form. The template's `parameters` are the graph's
   `request_fields` (typed → JSON-Schema form; enums → dropdowns).
3. The template's single custom step is **`platform:request:submit`**, which calls
   `platform-requests-backend` to create a **Request** (kind=`CREATE`, resource_type,
   params, requester) in state `PENDING_APPROVAL`. The Scaffolder task finishes
   immediately and links to the request. **It does not wait for Argo.**
4. An approver (RBAC-gated) approves in the **platform-requests** UI. On the
   terminal approval, `platform-requests-backend` renders the workflow arguments and
   **submits the Argo workflow via the Argo REST API**, stamping labels
   `platform.io/request-id=<id>` and `platform.io/type=<resource_type>`. Request →
   `IN_PROGRESS`, `workflow_name` recorded.
5. **`platform-argo-backend`** polls Argo (a scheduled task, by label) and mirrors
   the workflow phase onto the Request. The Request is **not `SUCCEEDED` until the
   Argo workflow Succeeds**. On `Failed`/`Error` → Request `FAILED` with the Argo
   message.
6. **The Argo workflow itself** commits the new `catalog-info.yaml` to the catalog
   repo as one of its steps (the generated WorkflowTemplate includes this; the
   seeded demo templates do too). Backstage ingests the new entity on its next
   catalog refresh. Our backend does **not** touch the catalog repo.

### 5.2 Edit / delete a resource

- From a resource entity page, **Edit** (form pre-filled from the entity's current
  spec) or **Delete** raises a Request (kind=`UPDATE` / `DELETE`) → same approval →
  the backend submits the type's `update`/`delete` verb workflow → the workflow
  performs the change and updates/removes the `catalog-info.yaml`. Request tracks to
  done exactly as create.

### 5.3 State machine

```
PENDING_APPROVAL ──approve──▶ APPROVED ──submit──▶ IN_PROGRESS ──argo Succeeded──▶ SUCCEEDED
       │                          (auto)              │
       └──reject──▶ REJECTED                          └──argo Failed/Error──▶ FAILED
```

Approval policies (SINGLE / N_OF_M / RBAC) carry over unchanged. `APPROVED→IN_PROGRESS`
is automatic (the backend submits on reaching APPROVED). Only `argo Succeeded` marks
a request finished — this is the "don't show finished until the workflow finishes"
requirement.

## 6. Graph builder → Scaffolder template

The **platform-builder** frontend keeps the React Flow canvas, block palette,
inspector, id-field choice box, verb tabs (create/update/delete), and request-fields
editor — carried over from the current builder.

**Save** now, via **platform-builder-backend**, generates and commits to the
**templates repo** (Gitea):

- `template.yaml` — a Backstage Scaffolder template:
  - `parameters`: derived from the graph's `request_fields` (typed JSON-Schema).
  - `steps`: `[ platform:request:submit ]` (passes resource_type + collected params).
  - `output`: link to the created request.
- The Argo **`WorkflowTemplate`** (+ `build-json.j2`) — as today, so Argo can
  `templateRef` it. Committed to the templates repo and applied to the cluster during
  instance seeding / on onboarding approval.

The **generator is ported to TypeScript** in `platform-builder-backend` (or
`platform-common`). The current Python golden fixtures
(`app-database.workflowtemplate.yaml`, `.build-json.j2`, create-delete variant)
become **TS test vectors** asserting byte-identical output — this is how we prove the
port is faithful.

Onboarding a new type still goes through admin approval (a `SERVICE_ONBOARDING`
request kind); on approval the template + WorkflowTemplate are published and the type
becomes requestable.

## 7. Data model (platform-requests-backend, knex)

- `requests(id, kind, resource_type, resource_name, params_json, state,
  approval_policy_json, requester, workflow_name, workflow_phase, error, created_at,
  updated_at)`
- `approvals(id, request_id, approver, decision, note, created_at)`
- `service_definitions(id, name, graphs_json, id_field, form_schema_json,
  generated_json, status, version, owner_team, created_at)`

`platform-argo-backend` keeps no durable state of its own beyond what it writes back
onto `requests` (workflow_name/phase/error); Argo is the source of truth for workflow
state.

## 8. RBAC / auth

- Keycloak OIDC sign-in resolver → Backstage identity; Keycloak groups ingested as
  `group:` entities (a Keycloak org-data provider or a periodic sync).
- A **permission policy** maps roles → permissions:
  - `requester`: create requests (run templates).
  - `service-owner`: author/onboard templates (builder), request.
  - `platform-admin`: approve onboarding + resource requests, all of the above.
  - `auditor`: read-only (view requests, catalog, status).
- Custom permissions: `platform.request.approve`, `platform.template.onboard`,
  `platform.resource.edit`, `platform.resource.delete`.

## 9. Argo status & completion gating

- **platform-argo-backend**: a typed Argo REST client against `argo-server`.
  A scheduled task lists workflows by `platform.io/request-id` label and updates the
  matching request's `workflow_phase`; drives `IN_PROGRESS → SUCCEEDED/FAILED`.
  Exposes `GET /requests/:id/workflow` (phase + per-node DAG + logs link).
- **platform-argo** (frontend): a status panel in the request detail (phase, DAG
  progress via React Flow, link to Argo logs) and an **Argo Workflow** tab on the
  resource entity page. On terminal phase it emits a native Backstage notification.

## 10. Notifications

Emit into Backstage's native notifications on: approval needed (→ approvers),
approved/rejected (→ requester), workflow finished/failed (→ requester + owners).
No custom notification center.

## 11. Theme

A custom MUI theme approximating the current palette, light/dark, and the changeable
color schemes; React Flow re-themed via CSS vars as today. Same modern feel; not
pixel-identical (Backstage is MUI, not shadcn/Tailwind).

## 12. Readymade instance

`scripts/backstage-up.sh` (sibling to the current `dev-up.sh`) brings up:

- **docker-compose**: Postgres (Backstage core + plugin DBs), **Keycloak** (existing
  realm/users: admin, requester, auditor), **Gitea** seeded with two repos —
  `software-templates` and `catalog` (the current 6 resources as `catalog-info.yaml`,
  the demo types as `template.yaml` + WorkflowTemplate), MinIO (optional/object store
  parity).
- **kind** cluster + **Argo Workflows** + `argo-server`, with seeded **function-block
  WorkflowTemplates** (fn-jinja-render, fn-api-call, fn-json-extractor, …) and **demo
  type WorkflowTemplates** that actually run: a short sleep/echo simulating
  provisioning **plus a git step that commits the resulting `catalog-info.yaml` to the
  Gitea catalog repo** (so entities visibly appear after a run).
- **Backstage app** (frontend + backend) wired to Keycloak, Gitea (catalog +
  scaffolder discovery + templates-repo write token), and `argo-server`.

Goal: `scripts/backstage-up.sh` → open Backstage → run a template → approve → watch
the Argo workflow run → see the request flip to finished → see the new resource
appear in the catalog.

## 13. Decomposition into sub-plans (build order)

Each is its own spec → plan → build cycle; this document is the umbrella design.

- **P0 — Bootable shell.** create-app; custom theme; Keycloak OIDC; Gitea + both repos
  seeded; kind + Argo installed with seeded function-block + one demo WorkflowTemplate;
  catalog ingesting the 6 resources. *Deliverable: Backstage boots, shows the catalog
  and one template, auth works.*
- **P1 — Requests backend + approvals.** knex DB + state machine + approval policies +
  permission policy; `platform-requests` UI (queue, request detail, approve/reject).
  *Deliverable: requests can be created (via API), approved, and rejected with RBAC.*
- **P2 — Scaffolder spine.** `platform:request:submit` action; one hand-written demo
  `template.yaml`; `platform-argo-backend` submit + poll; completion gating. *Deliverable:
  end-to-end create → request → approve → Argo runs → request finishes → entity appears.*
- **P3 — Graph builder plugin.** Port the generator to TS (golden vectors green);
  React Flow authoring UI; emit `template.yaml` + WorkflowTemplate; commit to Gitea;
  onboarding approval. *Deliverable: author a type in the UI, it becomes runnable.*
- **P4 — Catalog resource plugin.** Resource form/raw/dependency-graph views; edit +
  delete → UPDATE/DELETE requests. *Deliverable: full resource lifecycle from the UI.*
- **P5 — Argo status polish + notifications.** DAG tab, logs link, native
  notifications, gating hardening, e2e. *Deliverable: production-feel status UX.*

P0–P2 is the **critical spine**; validate it before P3+.

## 14. Testing strategy

- **Generator port**: TS unit tests asserting byte-identical output against the
  existing Python golden fixtures (ported as vectors). Non-negotiable gate for P3.
- **Backend plugins**: Backstage's plugin test harness + knex in-memory/pg for the
  state machine, approval policies, and Argo status transitions (Argo client mocked).
- **Frontend plugins**: component tests (React Testing Library) for the builder,
  request queue, and resource views.
- **End-to-end**: against the readymade instance — a Playwright (or Backstage e2e)
  run that executes the spine (P2) and the resource lifecycle (P4).
- Argo interactions are covered twice: unit (mocked REST) and e2e (real Argo on kind).

## 15. Non-goals / risks

- **Non-goals**: multi-cluster Argo; production Gitea→GitHub migration (config swap
  only); pixel-identical shadcn parity; retiring the legacy `apps/` (kept for fallback).
- **Risks**: (a) Gitea's GitHub-API compatibility for Scaffolder discovery/publish —
  mitigation: fall back to static `url` locations + a PAT for writes. (b) kind + Argo
  setup friction in the readymade script — mitigation: pin versions, provide a
  teardown, and a mock-Argo fallback flag if kind is unavailable. (c) Generator port
  fidelity — mitigation: golden vectors as a hard gate. (d) Keycloak↔Backstage group
  sync — mitigation: periodic org-data provider, documented realm export.
