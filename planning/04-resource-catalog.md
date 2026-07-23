# 04 — Resource Catalog (Git-backed)

## Source of truth

Resources and services are JSON files in a Git repo. **[R — user requirement]** The catalog is a
read-optimized view over those files; Git stays authoritative.

## Reference models (studied, not adopted)

The research compared the two dominant GitOps-catalog products so we make an informed build-vs-adopt
call **[R]**:

- **Backstage** — self-hosted React + Node; software catalog is `catalog-info` files discovered in
  Git; plugin-based RBAC; TypeScript plugin customization; **heavy build (≈2–4 FTE, 3–6 months)**.
- **Port** — API-first SaaS; JSON-schema "blueprint" entities; built-in granular RBAC + SSO;
  low-code UI config; **light build (≈2–4 weeks)** but SaaS and less custom-UI control.

**Decision: build a thin custom catalog. [D]** Rationale: our scope is narrower than Backstage
(one repo of JSON, one execution engine), we need deep control over the request/approval + Argo
flow, and adopting Backstage's weight or Port's SaaS model isn't justified. We borrow their proven
ideas — schema-defined entities (Port), Git-discovered catalog + `groups`-claim RBAC (Backstage).
If the catalog scope later explodes (many repos, many entity kinds, plugin demand), reevaluate
Backstage. **[D]**

## Indexing pipeline

```
Git repo ──(webhook on push)──▶ Sync worker ──parse+validate JSON──▶ Postgres catalog index
        └──(periodic poll, fallback)──┘                             (queryable, per-resource row)
```

- **Trigger:** Git provider webhook on push (primary) + periodic reconcile (fallback for missed
  hooks). **[D]**
- **Parse & validate:** each JSON validated against a **resource-type schema** (see below). Invalid
  files are indexed as `invalid` with the error surfaced to admins, not silently dropped. **[D]**
- **Index row:** `{ id, type, name, owner_team, git_path, git_sha, payload jsonb, status, updated_at }`.
- **Rebuildable:** the index can be dropped and rebuilt from Git — it holds no authoritative state. **[D]**

## Resource schema & ownership **[D]**

Two things every resource needs, and where they come from:

1. **Type schema** — defines fields + validation for each resource kind (e.g. `database`,
   `service`, `bucket`). Drives the request forms (schema-driven form generation) and validation.
   **Authored by service owners in the Service Request Builder** and stored as versioned Service
   Definitions ([10](10-service-request-builder.md)); early on they can be hand-authored JSON.
2. **Owner team** — the team that approves changes. Sourced by precedence:
   - explicit `metadata.ownerTeam` in the resource JSON (preferred), else
   - a path/prefix→team ownership map (config), else
   - a default/fallback team.

   The owner team string must align with the Keycloak/AD group used in the `groups` claim so
   approval authorization works ([03](03-auth-rbac.md), [05](05-approvals.md)).

## What the user sees

- **My resources** — resources filtered to what the user's roles/teams grant visibility to (RBAC +
  ownership). Data-dense, sortable/filterable grid (TanStack Table). **[D]**
- **Resource detail** — parsed fields, owner team, current Git SHA, "view raw JSON", change history
  (from Git log), and any in-flight request against it. **[D]**
- **Request change** — schema-driven form for update/delete; a create form for new resources of a
  chosen type. Submitting creates a Request ([05](05-approvals.md)).

## Visibility rules **[D]**

- `platform-admin` / `auditor`: all resources.
- Others: resources owned by their team(s), plus (optionally) a globally-readable set. Enforced in
  the BFF query, not just the UI. Tune during review — "who can see what before they own it" is a
  policy question for the platform team.
