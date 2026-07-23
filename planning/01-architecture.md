# 01 — Architecture

## Components

```
                          ┌─────────────────────────────────────────┐
        Browser           │                  BFF                     │
   ┌──────────────┐       │  ┌────────────┐  ┌──────────────────┐    │
   │  React SPA   │──HTTP─▶│  │ REST API   │  │ Git sync worker  │◀───┼── Git repo
   │  (Vite)      │◀─SSE──│  │ (requests, │  │ (pull JSON,      │    │   (resources
   │              │       │  │  catalog,  │  │  index → DB)     │    │    as .json)
   └──────────────┘       │  │  approvals)│  └──────────────────┘    │
        │ OIDC            │  └─────┬──────┘  ┌──────────────────┐    │
        │ (PKCE)          │        │         │ Argo watcher     │◀───┼── Argo Workflows
        ▼                 │        ▼         │ (SSE consumer)   │    │   REST API (:2746)
   ┌──────────┐           │   ┌─────────┐    └──────────────────┘    │
   │ Keycloak │◀──────────┼──▶│ Postgres│  ┌──────────────────┐     │
   │ (+AD/LDAP│  validate │   │ requests│  │ Notification svc │      │
   │  federation)         │   │ notifs  │  │ (fan-out → SSE)  │      │
   └──────────┘           │   │ rbac$   │  └──────────────────┘      │
                          │   └─────────┘                            │
                          └─────────────────────────────────────────┘
   $ rbac = cached role/ownership mappings; Keycloak remains source of identity
```

## Two data models: read vs write

The single most important architectural idea: **Git is the source of truth for resource _state_;
Postgres is the source of truth for request _process_.** They never fight because they describe
different things.

### Read model (what exists)
- Resources live as JSON files in a Git repo. **[R — user requirement]**
- A **Git sync worker** in the BFF pulls the repo (webhook-triggered + periodic fallback) and
  indexes the JSON into Postgres for fast query/filter/search and ownership lookups. **[D]**
- The DB index is a *cache*: it can be rebuilt from Git at any time. The UI reads from the index;
  "view raw" can read the file directly. **[D]**
- Each resource's JSON carries (or is mapped to) an **owner team** — the key that drives approval
  routing and RBAC visibility. See [04](04-resource-catalog.md). **[D]**

### Write model (what should change)
- A user never edits Git directly. They submit a **Request** (create/update/delete + payload).
- The request is a row in Postgres with a lifecycle state machine (see [05](05-approvals.md)).
- On approval, the BFF triggers an **Argo Workflow** that performs the real change. **The workflow
  is the only writer to Git** — the Argo template does the mutation and commits the resource JSON
  back. **The UI/BFF only ever reads from Git**; it never commits, pushes, or opens PRs. This keeps
  Git authoritative and keeps a single, auditable writer (the workflow). **[decided]**
- After the workflow commits, the sync worker re-indexes the changed file so the read model catches
  up (webhook + periodic reconcile). The user never waits on Git to see success — request status
  comes from the Argo watcher (see [06](06-argo-integration.md)).

## End-to-end flow (happy path)

1. User logs in via Keycloak (OIDC/PKCE); SPA gets tokens, BFF validates JWT, reads `groups` claim.
2. SPA lists the user's resources from the catalog index (filtered by RBAC + ownership).
3. User submits an update request → BFF stores it as `PENDING_APPROVAL`, resolves the owning team,
   notifies approvers.
4. An approver (member of the owning team) approves → BFF transitions to `APPROVED`, submits an Argo
   Workflow with the request payload as parameters.
5. Argo watcher streams `/workflow-events`; BFF maps node status → request status and pushes SSE
   updates to the requester's browser.
6. Workflow succeeds → resource JSON committed to Git → sync worker re-indexes → request `SUCCEEDED`;
   requester notified. On failure, BFF reads `status.nodes`, surfaces the failed step + message,
   request `FAILED`; requester notified. **[R]**

## Why a BFF (not SPA-direct-to-Argo/Keycloak-admin)

- The SPA must never hold the Argo service-account token or Keycloak admin creds. The BFF is the
  trust boundary: it authenticates the user (validates their OIDC token) and authorizes each action
  server-side before touching Argo/Git. **[D]**
- The BFF also does the impedance matching the browser can't: watching a long-lived Argo event
  stream, indexing Git, fanning out notifications.

## Deployment

- Everything runs in the same Kubernetes cluster as Argo (or one with network access to
  `argo-server:2746`). BFF talks to Argo in-cluster via a ServiceAccount. **[D]**
- Stateless BFF replicas behind an ingress; Postgres managed/HA; SSE connections are sticky per
  replica or backed by a shared pub/sub (see [07](07-notifications.md) for multi-replica fan-out). **[D]**
