# CB02 — Generator (graph → Jinja + WorkflowTemplate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** A **pure, deterministic** backend module that compiles a service's per-verb graphs into
(a) the `build-json.j2` Jinja template and (b) a single Argo `WorkflowTemplate` object with one
template per defined verb — matching the design's §6/§7 contracts exactly. This is the heart of the
feature; it gets the most test coverage and no UI.

**Architecture:** Graph model → validate (DAG, types, one `main`) → topological sort into **waves** →
emit `build-json.j2` (with `ph()` placeholders) + per-verb DAG templates (render-N → waves →
main-call) assembled into one `WorkflowTemplate`. Golden-file tested against design §6/§7.
(See [../../11-composable-service-builder.md](../../11-composable-service-builder.md) §5–§7, §10.)

**Tech Stack:** Python, jinja2, pyyaml, pydantic. No network/DB in the core (blocks passed in).

## Global Constraints
Pure & deterministic (no I/O, stable output ordering). Invalid graph → no partial output (raise).
Placeholder token `<<path>>`; paths are `mapping.children.*` / `mapping.internals.*` / `payload.*`.

## File structure
- `apps/bff/app/generator/graph.py` — graph model (`Node`, `Edge`, `ServiceGraph`, per-verb `Graphs`)
- `apps/bff/app/generator/validate.py` — DAG, type, single-main, block-exists checks
- `apps/bff/app/generator/waves.py` — topological wave grouping
- `apps/bff/app/generator/jinja_gen.py` — emit `build-json.j2`
- `apps/bff/app/generator/argo_gen.py` — emit the `WorkflowTemplate` (per-verb templates)
- `apps/bff/app/generator/generate.py` — `generate(graphs, blocks) -> Generated`
- `apps/bff/tests/generator/` — golden fixtures (`app-database` graph → expected j2 + yaml)

---

### Task 1: Graph model + validation
**Files:** Create `app/generator/graph.py`, `app/generator/validate.py`, `tests/generator/test_validate.py`
**Interfaces:** `Node(id, block, kind: main|dependency|internal, action?, config, input_bindings,
outputs)`; `Graphs(create?: ServiceGraph, update?, delete?)`; `validate(graph, blocks) ->
list[ValidationError]` (cycles, unbound required inputs, type-incompatible wires, ≠1 `main`, unknown
block/service).
- [ ] **Step 1: Failing test** — a valid `app-database` create graph → no errors; a cycle → error; a
  wire of `number`→`string` input where incompatible → error; two `main` nodes → error; missing
  required input binding → error.
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(gen): graph model + validation`.

### Task 2: Wave grouping (topological)
**Files:** Create `app/generator/waves.py`, `tests/generator/test_waves.py`
**Interfaces:** `waves(graph) -> list[list[NodeId]]` — nodes whose inputs are all satisfiable form a
wave; deterministic ordering (sort by id within a wave); the wave containing `main` is last.
- [ ] Failing test (`app-database`: wave1 = {network, lookup-account}, wave2 = {extract-account},
  wave-last = {main}; order stable) → fail → implement → pass → commit `feat(gen): wave grouping`.

### Task 3: Emit `build-json.j2` (with `ph()` placeholders)
**Files:** Create `app/generator/jinja_gen.py`, `tests/generator/test_jinja_gen.py` + golden
`app-database.build-json.j2`
**Interfaces:** `emit_jinja(graph) -> str` — produces the §6 template: `ph()` macro,
`payload`/`mapping.children`/`mapping.internals`, `request.*` for known-now values, `ph("path")` for
dependency/internal values, correct namespaced paths.
- [ ] **Step 1: Failing test** — `emit_jinja(app_database)` **exactly equals** the golden §6 file;
  AND rendering it with `resolved={}` yields `<<…>>` placeholders, with the full `resolved` map yields
  a fully-resolved payload (uses real jinja2 to render both passes).
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(gen): emit build-json.j2`.

### Task 4: Emit the Argo `WorkflowTemplate` (per-verb)
**Files:** Create `app/generator/argo_gen.py`, `tests/generator/test_argo_gen.py` + golden
`app-database.workflowtemplate.yaml`
**Interfaces:** `emit_workflow_template(graphs, blocks) -> str` — one `WorkflowTemplate` named for the
service; `spec.templates` has **one template per defined verb** (opt-in subset); each verb = DAG of
render-0 → dependency (`templateRef {name: dep, template: verb}`) + internal (`fn-*` templateRef) waves
→ render-N (resolved params) → main-call. Matches §7.
- [ ] **Step 1: Failing test** — `emit_workflow_template` for a create-only service emits exactly one
  `create` template; for create+delete emits both, each its own DAG; dependency nodes use
  `templateRef` to the dep service+verb; output equals the golden §7 YAML.
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(gen): emit workflowtemplate (per-verb)`.

### Task 5: `generate()` orchestration + recursion namespacing
**Files:** Create `app/generator/generate.py`, `tests/generator/test_generate.py`
**Interfaces:** `generate(graphs, blocks) -> Generated(build_json_j2, workflow_template_yaml)` —
validates, then jinja + argo emit; child service placeholders are namespaced by path prefix so a
nested dependency never collides with the parent.
- [ ] **Step 1: Failing test** — end-to-end `generate(app_database)` returns both artifacts matching
  goldens; a 2-level dependency (service A depends on B depends on C) namespaces placeholders under
  `mapping.children.B.…` / `…children.B…children.C.…` with no collisions; invalid graph raises (no
  partial output).
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(gen): generate() orchestration + recursion`.

## Env vars used
None.

## Exit / DoD
`generate(graphs, blocks)` deterministically produces the §6 `build-json.j2` and the §7
`WorkflowTemplate` (one object, per-verb templates, `templateRef` dependencies) — verified against
golden files, including a live jinja2 render proving placeholder resolution across waves. No UI, no
I/O — a pure, exhaustively-tested module the rest of the feature calls.
