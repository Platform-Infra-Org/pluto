# E08 — Service Request Builder & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** Let service owners visually build the request form for their service/resource type (→ a
JSON-Schema **Service Definition** + workflow binding), submit it for **admin onboarding approval**,
and — once approved — have it become requestable. Includes the three server-backed field types.

**Architecture:** A Service Definition (form JSON Schema + ui-schema + workflow binding +
`approval_policy` {mode, n?} + git_path) is authored in a headless builder that previews with the **same renderer** as real
request forms (E05). Onboarding reuses the E05 state machine with `kind=SERVICE_ONBOARDING` →
approver **platform-admin**; on approval a workflow commits the definition JSON to Git (sole writer)
and the catalog indexes it → `ACTIVE`. **Versioning: pin-until-migrated.** **[decided]** (See
[../10-service-request-builder.md](../10-service-request-builder.md).)

**Tech Stack:** React (headless builder), JSON Schema, FastAPI (option-source poller, upload proxy),
Keycloak Admin API (groups), S3/MinIO (uploads), httpx (external API sync).

## Global Constraints
Admins approve onboarding (not owner team). Uploads → Argo artifact repo (reused), never Git.
Dynamic-choice `refresh_interval` ≥ 60s. Owners can't self-approve onboarding. See README.

## File structure
- `apps/bff/app/services/definition.py` — `ServiceDefinition` model + versioning
- `apps/bff/app/services/onboarding.py` — SERVICE_ONBOARDING lane (reuses E05 state)
- `apps/bff/app/services/fields/groups.py` — groups picker (Keycloak/LDAP)
- `apps/bff/app/services/fields/upload.py` — file upload → artifact repo
- `apps/bff/app/services/fields/option_source.py` — external-API poller + cache
- `apps/bff/app/api/services.py`, `app/api/fields.py`
- `apps/web/src/app/builder/*` (canvas, field editor, binding panel, preview), shared
  `src/app/forms/SchemaForm.tsx` (used by E05 too)
- tests under `tests/services/`

---

### Task 1: ServiceDefinition model + versioning
**Files:** Create `app/services/definition.py`, migration, `tests/services/test_definition.py`
**Interfaces:** Produces `ServiceDefinition(id, name, category, owner_team, form_schema, ui_schema,
workflow_binding, approval_policy {mode: SINGLE|N_OF_M|RBAC, n?}, git_path, status, version)`;
resources record `definition_version`; `pin-until-migrated` — lookups resolve a resource against its
pinned version. `approval_policy` is the type default (a resource may override; see E05). **Retire is
blocked while any resource of the type still exists** (decided). **[decided]**
- [ ] Failing test (new version bumps; existing resource still resolves old version; retire with a
  live resource → 409) → fail → implement+migrate → pass → commit
  `feat(services): definition model + pinned versioning + retire guard`.

### Task 2: Shared headless SchemaForm renderer
**Files:** Create `apps/web/src/app/forms/SchemaForm.tsx`, tests; refactor E05 form to use it
**Interfaces:** Produces `<SchemaForm schema uiSchema value onChange />` mapping JSON-Schema types →
shadcn/ui fields (incl. the server-backed field types). One renderer for builder preview AND real
request forms.
- [ ] Failing test (renders required/enum/number fields; validation errors show) → fail → implement →
  pass → commit `feat(web): shared schema form renderer`.

### Task 3: Groups picker field (Keycloak/LDAP)
**Files:** Create `app/services/fields/groups.py`, `app/api/fields.py` (`GET /api/fields/groups`),
`tests/services/test_groups_field.py`
**Interfaces:** Produces `GET /api/fields/groups?scope=` → groups from Keycloak Admin API, scoped
(base DN/prefix or requester's own groups); browser never hits the directory. **[D]**
- [ ] Failing test (returns scoped groups; unscoped/whole-directory rejected) → fail → implement
  (Keycloak Admin API via `OIDC_CLIENT_ID_BFF`) → pass → commit `feat(fields): groups picker`.

### Task 4: File upload field → Argo artifact repo
**Files:** Create `app/services/fields/upload.py` (`POST /api/fields/upload`),
`tests/services/test_upload.py`
**Interfaces:** Produces upload endpoint enforcing `ARTIFACT_MAX_UPLOAD_MB` + allowed types, storing
to `ARTIFACT_S3_*` under `uploads/`, returning `{uri, checksum, filename, size}` for the payload;
consumed by the workflow as an input artifact (E06). **[decided]**
- [ ] Failing test (valid file → reference; oversize/blocked type → 4xx) → fail → implement (S3
  client) → pass → commit `feat(fields): file upload → artifact repo`.

### Task 5: Dynamic choice option-source poller
**Files:** Create `app/services/fields/option_source.py`, migration for `OptionSource`,
`tests/services/test_option_source.py`
**Interfaces:** Produces `OptionSource(id, url, method, auth_secret_ref, mapping, refresh_interval,
cached_options, last_synced_at, last_status)`; a scheduler polling each source at its interval
(**clamped ≥60s**), dedup by source, **last-good on failure**; `GET /api/fields/options/{source_id}`
serves from cache. **[decided]**
- [ ] **Step 1: Failing test** — poller fetches + maps options into cache; a failing refresh keeps
  the last-good cache and marks `last_status=stale`; interval < 60s is clamped.
- [ ] Steps 2–4: implement httpx fetch + JSONPath mapping + cache; pass.
- [ ] Commit `feat(fields): external-api option source poller`.

### Task 6: Onboarding lane (admin approval → Git → ACTIVE)
**Files:** Create `app/services/onboarding.py`, modify `app/api/services.py`, `tests/services/test_onboarding.py`
**Interfaces:** Produces submit-definition → `SERVICE_ONBOARDING` request (E05 machine); approver =
`platform-admin`; on approve, workflow commits the definition JSON to Git → catalog indexes →
`status=ACTIVE`; reject returns to owner with notes; drafts live in Postgres until submitted. **[decided]**
- [ ] Failing test (owner submits; owner can't self-approve; admin approves → definition ACTIVE &
  requestable) → fail → implement → pass → commit `feat(services): onboarding approval lane`.

### Task 7: SPA — builder + admin onboarding queue
**Files:** Create `src/app/builder/{canvas,field-editor,binding,preview}.tsx`,
`src/app/services/{mine,onboarding-queue}.tsx`, tests
**Interfaces:** Builder edits fields (incl. server-backed types) + workflow binding + **approval
policy** (SINGLE/N_OF_M/RBAC); **live preview uses `SchemaForm`**; "my definitions" with status;
admin onboarding queue with form preview + binding + **policy** review + approve/reject.
- [ ] Failing test (builder emits valid JSON Schema; preview matches; `service-owner`-only access) →
  fail → implement → pass → commit `feat(web): service builder + onboarding queue`.

## Env vars used
`KEYCLOAK_ADMIN_BASE_URL`, `OIDC_CLIENT_ID_BFF`, `OIDC_CLIENT_SECRET_BFF`, `ARTIFACT_S3_ENDPOINT`,
`ARTIFACT_S3_BUCKET`, `ARTIFACT_S3_ACCESS_KEY`, `ARTIFACT_S3_SECRET_KEY`, `ARTIFACT_MAX_UPLOAD_MB`
(inputs §1, §4).

## Blocks on inputs
§1 groups-picker scope + BFF confidential client; §4 artifact bucket + write access; an example
external API (§8) for the dynamic-choice test. (Retire-with-live-resources = **block**, decided.)

## Exit / DoD
A service owner builds a form with a groups picker, a file upload, and an external-API-synced choice,
previews it exactly as requesters will see it, and submits it; an admin approves; the type becomes
requestable and drives a real E05/E06 request — no code change.
