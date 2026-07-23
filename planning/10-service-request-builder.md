# 10 — Service Request Builder & Service Onboarding

A module that lets **service owners define the request form for their own service/resource type**,
and lets **platform admins approve** a new/updated service before it goes live in the catalog. It is
the authoring surface behind the schema-driven forms in [04](04-resource-catalog.md).

Two capabilities:
1. **Form builder** — a visual editor where a service owner defines the fields, validation, layout,
   and workflow binding for their service type.
2. **Service onboarding approval** — the resulting **Service Definition** is submitted as an
   onboarding request that **admins** approve before the type becomes requestable.

All **[D]** (design decisions) — this was a direct requirement, not a researched finding.

## The Service Definition

The unit this module produces. One per requestable service/resource type.

```
ServiceDefinition {
  id, name, description, category, icon
  owner_team        : team that approves RESOURCE change-requests of this type (see 05)
  form_schema       : JSON Schema  — fields, types, required, validation, enums
  ui_schema         : layout/order/widget hints (sections, field order, secret masking)
  workflow_binding  : {
      create: { template_ref, param_map },   // form field key -> workflow parameter
      update: { template_ref, param_map },
      delete: { template_ref, param_map },
  }
  approval_policy    : default policy for change-requests of this type —
                       { mode: SINGLE | N_OF_M | RBAC, n? }  (a resource may override; see 05)
  git_path           : where the resource JSONs of this type live
  status             : DRAFT | PENDING_ONBOARDING | ACTIVE | RETIRED
  version            : bumped on each approved change
}
```

## The form builder (headless)

- **Output format: JSON Schema + a UI-schema.** Standard, portable, and the *same* schema the BFF
  uses to validate submitted request payloads (Pydantic/`jsonschema`) — author once, validate
  everywhere. **[D]**
- **Field types (base):** string, number, boolean, enum/select, multi-select, date,
  **secret/masked**, nested object, array/list, and **reference-to-another-resource** (pick an
  existing resource as a value). **[D]**
- **Field types (server-backed)** — three types whose *values or options* come from the BFF, not a
  static schema, so they need backend support (see "Server-backed fields" below): **groups picker**
  (SSO/LDAP), **file upload**, and **dynamic choice box** (external-API-synced). **[D]**
- **Per field:** label, key, required, default, validation (regex / min / max / pattern), help text,
  and basic conditional visibility (show field B when A = x). **[D]**
- **Rendered with our headless components** (map each schema type → a shadcn/ui field), *not* a
  batteries-included form kit — keeps the builder and the real request forms visually identical and
  under our control. JSON Schema is the interchange; RJSF (react-jsonschema-form) was considered but
  we render with our own headless fields for design consistency. **[D]**
- **Live preview:** the builder renders the form with the *exact same renderer* requesters will use,
  so "what the owner builds" = "what the requester sees." No second rendering path. **[D]**
- **Workflow binding:** the owner selects the Argo **WorkflowTemplate** for each action and maps
  form fields → workflow parameters. This is what makes an approved request executable ([06](06-argo-integration.md)). **[D]**
- **Approval policy:** the owner sets this type's default `approval_policy` — `SINGLE`, `N_OF_M(n)`,
  or `RBAC` ([05](05-approvals.md)); **admins review it at onboarding** (a lax policy on a sensitive
  type is exactly what onboarding approval is meant to catch). **[decided]**

## Server-backed fields

Three field types can't be pure client widgets — their options or storage live in the BFF. Each is
still authored in the builder (the owner configures it), but the BFF serves the data. **[D]**

### Groups picker (SSO/LDAP)
- A select whose options are **Keycloak/LDAP groups**, served by the BFF from its privileged
  directory access ([03](03-auth-rbac.md)) — the browser never queries the directory directly.
- **Config:** single vs multi-select; **scope** to limit exposure — a base DN / group prefix, or
  "only groups the requester is a member of" (read from their `groups` claim). Default: scoped, not
  the whole directory.
- **Value stored:** group id(s)/name(s). Typical uses: who owns the resource, which groups get
  access. Aligns with the same group names used for RBAC/ownership, so it composes cleanly.

### File upload
- Uploads a file as part of the request (e.g. a cert, a config bundle).
- **The file is NOT inlined into the resource JSON in Git.** The BFF stores it in the **Argo
  artifact repository (S3/MinIO)** — reused, no separate bucket — and puts a **reference** (URI +
  checksum + filename + size) in the request payload; the workflow consumes it as an **input
  artifact** ([06](06-argo-integration.md)). Keeps Git free of binaries and large blobs.
- **Config:** allowed extensions/MIME types, max size, single vs multiple.
- ponytail: small text configs (< a few KB) *may* inline as a capped string field instead of an
  artifact, if the owner prefers — but binaries always go to object storage.

### Dynamic choice box (external-API-synced)
- A select whose options come from an **external API**, refreshed on a **configurable interval**
  (default ~5 minutes).
- **Config per source:** `url` + method, auth (a **secret reference**, not an inline credential),
  response **mapping** (path → `{label, value}`), and `refresh_interval` (the configurable sync
  period, **clamped to a 60s minimum**). **[D]**
- **How it stays fast and safe — a BFF option-source poller:** the BFF fetches each configured
  source on its own interval and **caches** the resulting option list (Postgres). Forms read options
  **from the cache**, never live per render — so form loads are instant and the external API is hit
  once per interval regardless of how many users open the form. **[D]**
  - Sources are **deduplicated**: N fields pointing at the same source share one cached fetch.
  - **On refresh failure**, the poller keeps serving the **last-good** cache and marks it stale
    (surfaced to admins), so a flaky upstream never breaks the form.

```
OptionSource {                     // one per distinct external source
  id, url, method, auth_secret_ref,
  mapping: { label_path, value_path },
  refresh_interval_seconds,        // configurable "every few minutes"
  cached_options[], last_synced_at, last_status
}
```

## Onboarding flow (reuses the approval machinery)

The onboarding request is just a **Request of a different kind** ([05](05-approvals.md)) — same
state machine, different approver resolution.

```
Service owner builds/edits definition (DRAFT)
        │ submit
        ▼
 SERVICE_ONBOARDING request ──approve (admins)──▶ workflow commits definition JSON to Git
        │ reject                                        │ (sole writer; UI reads)
        ▼                                               ▼
  back to owner w/ notes                    catalog indexes it → status ACTIVE
                                            → type becomes requestable
```

- **Approver = `platform-admin`**, not the owner team. Admins gatekeep what enters the platform and
  verify the workflow binding / parameter mapping is safe before it can run. **[D]**
- **On approval**, the definition JSON is committed to Git by a workflow (consistent with the
  write model — the workflow is the sole Git writer, the UI only reads; see
  [01](01-architecture.md)), then indexed by the catalog sync worker → `ACTIVE`. **[D]**
- **Editing a live definition** goes through the same onboarding-approval path and bumps `version`.
  **Versioning policy: pin-until-migrated (default).** Each resource records the definition version
  it was created under and keeps validating/rendering against *that* version; new create-requests
  use the latest; existing resources are migrated only by an explicit action (which fills/defaults
  any new fields). This prevents a form edit — e.g. a newly-required field or tighter validation —
  from retroactively invalidating live resources or blocking unrelated updates. The alternative,
  auto-migrate (one active schema, existing resources must conform immediately), is simpler but
  unsafe once owners self-serve non-backward-compatible edits. **[decided: pin]** **[D]**
- **Draft storage:** work-in-progress definitions live in Postgres until submitted, so the builder
  doesn't churn Git; only approved definitions land in Git. **[D]**

## Two approval lanes — don't confuse them

| Lane | What's approved | Approver | Policy |
|------|-----------------|----------|--------|
| **Service onboarding** (this module) | a service *type* + its form + workflow binding | **platform-admin** | admin sign-off |
| **Resource change** ([05](05-approvals.md)) | an *instance*: create/update/delete of a resource | **owner team** (or RBAC-permitted) | per-resource: SINGLE / N_OF_M / RBAC |

Same `Request` state machine and audit trail; the `kind` field selects the approver-resolution rule.

## RBAC additions ([03](03-auth-rbac.md))

- **`service-owner`** capability (role or team attribute): may create/edit Service Definitions for
  their team and submit onboarding requests. **[D]**
- **`platform-admin`**: approves/rejects onboarding requests (already the admin role). **[D]**
- A service owner cannot self-approve onboarding (separation of duties — admins are a different
  role). **[D]**

## UI surfaces

- **Builder** — field-list/canvas editor + per-field settings + workflow-binding panel + **live
  preview**.
- **My service definitions** — list with status (DRAFT / PENDING_ONBOARDING / ACTIVE / RETIRED).
- **Admin onboarding queue** — pending onboarding requests, each showing the form preview, the
  workflow binding + parameter map, and approve/reject with notes.

## Decided defaults

- **File-upload storage:** reuse the **Argo artifact repository** (the object store Argo already
  uses for workflow artifacts) — no separate bucket; uploads become workflow input artifacts
  directly ([06](06-argo-integration.md)).
- **Dynamic-choice refresh floor:** `refresh_interval` is configurable but clamped to a **60-second
  minimum**, so a misconfigured field can't hammer an external API.

## Open questions (for review)

- Any further field types beyond base + the three server-backed ones (groups picker, file upload,
  dynamic choice)? e.g. key-value map.
- Retiring a type with live resources: block until they're removed, or allow retire + orphan?
