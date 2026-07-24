# CB01 — Function Block Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** A registry of reusable **function blocks** — each a manifest (typed inputs/outputs + UI
hints) bound to an Argo WorkflowTemplate — that platform-admins can onboard, plus auto-derived
manifests for service blocks. This is the vocabulary everything else composes from.

**Architecture:** A `FunctionBlock` model + manifest parser/validator (pydantic over YAML). Service
blocks derive a manifest from their `ServiceDefinition`. Admin-only CRUD API + a block-onboarding SPA
screen. Seed the v1 built-ins from design §8. (See [../../11-composable-service-builder.md](../../11-composable-service-builder.md) §2, §3, §8.)

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, PyYAML; React+TS SPA, shadcn/ui.

## Global Constraints
Admin-only block onboarding (`require_role("platform-admin")`). Manifests are validated before store.
Type system: `string | number | boolean | json | enum[...] | map<string,T> | jsonpath | secretRef`.

## File structure
- `apps/bff/app/blocks/manifest.py` — manifest schema + parse/validate
- `apps/bff/app/blocks/model.py` — `FunctionBlock` table
- `apps/bff/app/blocks/service_block.py` — derive a block manifest from a `ServiceDefinition`
- `apps/bff/app/blocks/registry.py` — list/get/upsert; type-compatibility helper
- `apps/bff/app/api/blocks.py` — `/api/blocks` CRUD (admin) + `GET /api/blocks` (composers read)
- `apps/bff/app/blocks/seed.py` — v1 built-ins (§8)
- `apps/web/src/app/blocks/onboard.tsx` — platform block-onboarding screen
- tests under `apps/bff/tests/blocks/`

---

### Task 1: Manifest schema + parser/validator
**Files:** Create `app/blocks/manifest.py`, `tests/blocks/test_manifest.py`
**Interfaces:** Produces `BlockManifest(name, category, icon, template_ref, inputs: list[IOField],
outputs: list[IOField], ui)`; `IOField(name, type: IOType, required)`; `parse_manifest(yaml_str) ->
BlockManifest` (raises `ManifestError` on bad type/missing field); `is_assignable(src: IOType, dst:
IOType) -> bool` (with `json` as permissive top type).
- [ ] **Step 1: Failing test** — parse the §3 `api-call` + `json-extractor` YAML manifests → correct
  typed IO; a manifest with an unknown type or missing `template.ref` raises `ManifestError`;
  `is_assignable(string, json)` true, `is_assignable(json, number)` false.
- [ ] Steps 2–4: implement pydantic models + YAML parse + type grammar; pass.
- [ ] Commit `feat(blocks): manifest schema + parser + type assignability`.

### Task 2: `FunctionBlock` model + migration
**Files:** Create `app/blocks/model.py`, migration, `tests/blocks/test_model.py`
**Interfaces:** `FunctionBlock(id, name, version, category, template_ref, manifest: jsonb, created_by,
created_at)`; unique on `(name, version)`.
- [ ] Failing test (insert + query a block round-trips the manifest jsonb) → fail → implement+migrate
  → pass → commit `feat(blocks): function block model`.

### Task 3: Service-block manifest derivation
**Files:** Create `app/blocks/service_block.py`, `tests/blocks/test_service_block.py`
**Interfaces:** `derive_service_block(defn: ServiceDefinition) -> BlockManifest` — inputs = the
service's declared request fields it needs; outputs = the service's declared outputs; `template_ref`
= the service's own WorkflowTemplate name; category `service`.
- [ ] Failing test (a ServiceDefinition → a valid block manifest with matching IO) → fail → implement
  → pass → commit `feat(blocks): derive service-block manifests`.

### Task 4: Registry + blocks API
**Files:** Create `app/blocks/registry.py`, `app/api/blocks.py`, `tests/blocks/test_api.py`
**Interfaces:** `GET /api/blocks` (any authed composer — lists function blocks + active service
blocks), `POST/PUT /api/blocks` (**admin only** — upsert a function block from manifest YAML),
`GET /api/blocks/{name}`. Validates the manifest on write; 403 for non-admin writes.
- [ ] **Step 1: Failing test** — non-admin POST → 403; admin POST a valid manifest → stored + listed;
  `GET /api/blocks` includes seeded built-ins + active service blocks; invalid manifest → 422.
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(blocks): registry + admin-gated blocks api`.

### Task 5: Seed v1 built-ins
**Files:** Create `app/blocks/seed.py`, `tests/blocks/test_seed.py`
**Interfaces:** `seed_builtins(session)` inserts `api-call`, `json-extractor`, `set-value`,
`git-commit`, `jinja-render` manifests (design §8), idempotent.
- [ ] Failing test (after seed, all 5 built-ins present with typed IO; re-run doesn't duplicate) →
  fail → implement → pass → commit `feat(blocks): seed v1 built-in function blocks`.

### Task 6: SPA — platform block-onboarding screen
**Files:** Create `apps/web/src/app/blocks/onboard.tsx`, test; route `/blocks` (admin-gated)
**Interfaces:** A form to paste a block manifest (YAML) + WorkflowTemplate ref → validates via
`POST /api/blocks`; lists existing blocks. Admin-only route.
- [ ] Failing test (non-admin can't reach `/blocks`; admin submits a manifest → appears in the list;
  invalid YAML shows the error) → fail → implement → pass → commit `feat(web): block-onboarding screen`.

## Env vars used
None new.

## Exit / DoD
A platform-admin registers a function block from a manifest (or uses the seeded built-ins), composers
can `GET /api/blocks` to see function + active service blocks with typed IO, and the type-assignability
helper is proven. This is the palette CB02/CB03 build on.
