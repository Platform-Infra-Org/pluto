# CB04 — Onboarding Wiring & Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** Persist a service's per-verb graphs + generated artifacts on its `ServiceDefinition`, run
the whole thing through the existing E08 onboarding-approval lane (admins review the generated YAML),
support full re-editability (edit graphs, add/remove verbs) with version bumps, and **print** the
generated templates for the platform team to commit to Git.

**Architecture:** Extend `ServiceDefinition` with `graphs {create?,update?,delete?}` and `generated
{build_json_j2, workflow_template_yaml}`; regenerate on save (CB02); route submit → `SERVICE_ONBOARDING`
(E08) with the generated YAML in the admin review; edits bump the version (pin-until-migrated).
(See [../../11-composable-service-builder.md](../../11-composable-service-builder.md) §4, §7, §10, §14.)

**Tech Stack:** FastAPI, SQLAlchemy, Alembic; the E08 onboarding lane; CB02 generator; CB03 editor.

## Global Constraints
BFF never writes Git — the generated templates are **printed** (returned/displayed) for the platform
team to commit. Onboarding approved by `platform-admin` (not owner team). Verbs opt-in; every edit
re-enters approval and bumps the version. Server-side authz throughout.

## File structure
- `apps/bff/app/services/definition.py` — extend model with `graphs`, `generated` (migration)
- `apps/bff/app/services/compose.py` — save graphs → regenerate (CB02) → persist
- `apps/bff/app/api/services.py` — extend definition submit/edit endpoints
- `apps/bff/app/blocks/drift.py` — pinned block version → drift detection
- `apps/web/src/app/builder/canvas.tsx` — wire the CB03 editor into the definition save/submit flow
- `apps/web/src/app/services/onboarding-queue.tsx` — admin sees generated YAML in review
- tests under `apps/bff/tests/services/`

---

### Task 1: Extend `ServiceDefinition` (graphs + generated) + migration
**Files:** Modify `app/services/definition.py`, migration, `tests/services/test_definition_graphs.py`
**Interfaces:** Add `graphs: jsonb {create?,update?,delete?}`, `generated: jsonb {build_json_j2,
workflow_template_yaml}`, `block_versions: jsonb` (pinned). Existing form/policy/version stay.
- [ ] Failing test (a definition persists per-verb graphs + generated artifacts; only defined verbs
  present) → fail → implement+migrate → pass → commit `feat(services): definition graphs + generated`.

### Task 2: Save → regenerate → persist
**Files:** Create `app/services/compose.py`, `tests/services/test_compose.py`
**Interfaces:** `save_graphs(defn, graphs) -> ServiceDefinition` — validates + regenerates via CB02
`generate()`, stores `generated` + pins current block versions; rejects an invalid graph (no persist).
- [ ] Failing test (saving valid graphs stores regenerated artifacts + pinned block versions; invalid
  graph → 4xx, nothing persisted) → fail → implement → pass → commit `feat(services): compose+regenerate on save`.

### Task 3: Opt-in verbs + full editability + version bump
**Files:** Modify `app/api/services.py`, `tests/services/test_edit_verbs.py`
**Interfaces:** Endpoints to edit a verb's graph, **add/remove a verb** (non-empty subset), and
resubmit — each edit **bumps the definition version** and re-enters `SERVICE_ONBOARDING`
(pin-until-migrated: existing resources keep their pinned version).
- [ ] **Step 1: Failing test** — add a `delete` verb to a create-only service → regenerates with both
  templates + new version; remove a verb → regenerates; existing resources still resolve their old
  version; each edit creates a pending onboarding request.
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(services): opt-in verbs + editable + versioned`.

### Task 4: Block-drift detection
**Files:** Create `app/blocks/drift.py`, `tests/blocks/test_drift.py`
**Interfaces:** `drift(defn) -> list[BlockDrift]` — a pinned block version differs from the registry's
latest → flag; the definition surfaces "drifted" for the owner to re-validate.
- [ ] Failing test (bumping a used block's version flags the definition as drifted; unchanged → no
  drift) → fail → implement → pass → commit `feat(blocks): drift detection vs pinned versions`.

### Task 5: Admin review shows generated YAML + print-for-Git
**Files:** Modify `apps/web/src/app/services/onboarding-queue.tsx`, `apps/web/src/app/builder/canvas.tsx`, tests
**Interfaces:** The onboarding queue shows the **generated WorkflowTemplate + build-json.j2** for the
admin to review before approving; on approval the definition goes ACTIVE and the generated templates
are **displayed/downloadable** for the platform team to commit to Git (BFF does not write Git).
- [ ] Failing test (admin review renders the generated YAML; approve → ACTIVE + templates shown for
  copy/download; non-admin can't approve) → fail → implement → pass → commit `feat(web): review generated yaml + print-for-git`.

## Env vars used
None new.

## Exit / DoD
An owner composes per-verb graphs, saves (auto-regenerated), and submits; an admin reviews the exact
generated WorkflowTemplate + Jinja and approves; the type becomes requestable and its templates are
printed for Git. Editing graphs or adding/removing verbs later bumps the version without breaking
existing resources; a changed block flags drift.
