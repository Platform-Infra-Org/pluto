# CB03 — Graph Editor UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** A visual canvas where a service owner composes a per-verb graph from the block palette,
wires inputs/outputs, and sees the generated `build-json.j2` + `WorkflowTemplate` update live.
Produces the graph JSON that CB02 compiles.

**Architecture:** React-Flow canvas + palette (from `/api/blocks`, CB01) + right-side inspector
(per-node input bindings/config/outputs) + a live-preview tab that POSTs the graph to a generate
endpoint (CB02) and renders the returned YAML/Jinja. Verb tabs (create/update/delete) let owners
compose each supported verb independently. (See [../../11-composable-service-builder.md](../../11-composable-service-builder.md) §4, §9.)

**Tech Stack:** React+TS+Vite, `@xyflow/react` (React Flow), TanStack Query, shadcn/ui + Tailwind.

## Global Constraints
Client-side `<Link>` nav (never `<a href>`). Display-only role gating; server enforces authz. Graph
edits produce a validated graph JSON matching CB02's `Graphs` shape. Preview is generated server-side
(CB02), never in the browser.

## File structure
- `apps/web/src/app/builder/graph/canvas.tsx` — React Flow canvas
- `apps/web/src/app/builder/graph/palette.tsx` — block palette from `/api/blocks`
- `apps/web/src/app/builder/graph/inspector.tsx` — per-node bindings/config/outputs
- `apps/web/src/app/builder/graph/verb-tabs.tsx` — create/update/delete tabs + add/remove verb
- `apps/web/src/app/builder/graph/preview.tsx` — live generated Jinja + WorkflowTemplate
- `apps/web/src/lib/graph.ts` — graph JSON types + `/api/blocks` + generate client
- `apps/bff/app/api/generate.py` — `POST /api/services/generate` (graphs → generated; calls CB02)
- tests under `apps/web/src/app/builder/graph/`

---

### Task 1: Generate endpoint (thin wrapper over CB02)
**Files:** Create `apps/bff/app/api/generate.py`, `tests/generator/test_generate_api.py`
**Interfaces:** `POST /api/services/generate` (authed; body = `{graphs}`) → `{build_json_j2,
workflow_template_yaml, errors[]}`; loads blocks from the registry, calls `generate()` (CB02);
returns validation errors instead of raising (for live preview).
- [ ] Failing test (valid graphs → artifacts; invalid graph → 200 with `errors`, no partial YAML) →
  fail → implement → pass → commit `feat(gen): generate preview endpoint`.

### Task 2: Graph types + block/generate client
**Files:** Create `apps/web/src/lib/graph.ts`, test
**Interfaces:** TS types mirroring CB02 `Graphs`/`Node`; `fetchBlocks()`, `generate(graphs)`.
- [ ] Failing test (client shapes; generate() calls the endpoint) → fail → implement → pass → commit
  `feat(web): graph types + block/generate client`.

### Task 3: Palette + canvas (drag block → node, wire ports)
**Files:** Create `canvas.tsx`, `palette.tsx`, tests
**Interfaces:** Palette lists function + service blocks (typed ports); dragging adds a node; connecting
an output port → an input port creates an edge → updates the graph JSON. Invalid-type connections are
rejected/flagged (using CB01 type info).
- [ ] Failing test (dropping a block adds a node; a valid wire creates an edge in the graph JSON; an
  incompatible-type wire is refused) → fail → implement → pass → commit `feat(web): graph palette + canvas`.

### Task 4: Inspector (bindings, config, outputs, main flag)
**Files:** Create `inspector.tsx`, test
**Interfaces:** For the selected node: bind each input to `request.<field>` | `node.<id>.outputs.<n>`
| literal; edit block config; name outputs; mark exactly one node `main`.
- [ ] Failing test (binding a required input clears its error; marking a second node main unmarks the
  first) → fail → implement → pass → commit `feat(web): node inspector`.

### Task 5: Verb tabs (opt-in create/update/delete)
**Files:** Create `verb-tabs.tsx`, test
**Interfaces:** Tabs for each supported verb; add/remove a verb (any non-empty subset); each verb
holds its own graph.
- [ ] Failing test (add `delete` verb → a second empty graph; remove `update` → gone; can't remove the
  last verb) → fail → implement → pass → commit `feat(web): per-verb graph tabs`.

### Task 6: Live preview
**Files:** Create `preview.tsx`, test
**Interfaces:** On graph change (debounced) calls `generate()` and shows the returned `build-json.j2`
and `WorkflowTemplate` YAML (syntax-highlighted), or the validation errors.
- [ ] Failing test (editing the graph updates the preview; an invalid graph shows errors, not YAML) →
  fail → implement → pass → commit `feat(web): live generated preview`.

## Env vars used
None new.

## Exit / DoD
A service owner drags blocks onto the canvas, wires request fields → steps → main call across
per-verb tabs, and watches the generated Jinja + WorkflowTemplate update live — producing the graph
JSON CB04 persists. Invalid wiring is flagged before generation.
