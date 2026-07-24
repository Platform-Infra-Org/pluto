# CB05 — Runtime `fn-*` WorkflowTemplates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** The platform-provided runtime building blocks — the `fn-*` Argo WorkflowTemplates that the
generated service templates reference: `fn-jinja-render` (builds/re-renders the big JSON),
`fn-api-call`, `fn-json-extractor`, `fn-set-value`, `fn-git-commit`. These make a generated service
template actually executable.

**Architecture:** Each `fn-*` is a small container-based WorkflowTemplate with typed params matching
its CB01 manifest. `fn-jinja-render` runs the Jinja engine (design §6) over `request` + `resolved` →
big JSON / `payload`. Core logic is unit-tested as pure Python; the Argo wrapper is live-Argo-deferred
where a cluster is needed. (See [../../11-composable-service-builder.md](../../11-composable-service-builder.md) §5, §6, §8.)

**Tech Stack:** Python (jinja2, jsonpath, httpx) packaged into a small runner image; Argo
WorkflowTemplate YAML; Git for `fn-git-commit`.

## Global Constraints
`fn-jinja-render` must exactly implement the §6 resolution (`ph()` placeholders, `resolved` map,
`<<…>>` tokens). `fn-git-commit` is the ONLY writer to Git (the sole-writer invariant lives here, not
in the BFF). Secrets: `fn-api-call` resolves a `secretRef` by name from a **cluster Secret**, never
inlined. Live-Argo acceptance is DEFERRED where no cluster exists (skipif-gated), unit logic runs fully.

## File structure
- `runtime/fn/render.py` — Jinja render/resolve engine (pure)
- `runtime/fn/api_call.py` — HTTP call + secretRef resolution
- `runtime/fn/json_extract.py` — JSONPath extraction
- `runtime/fn/set_value.py` — expression/transform
- `runtime/fn/git_commit.py` — commit resource JSON to Git
- `runtime/argo/fn-*.yaml` — the WorkflowTemplate wrappers
- `runtime/Dockerfile` — the runner image
- tests under `runtime/tests/`

---

### Task 1: `fn-jinja-render` engine (pure) — the §6 resolver
**Files:** Create `runtime/fn/render.py`, `runtime/tests/test_render.py`
**Interfaces:** `render(template_j2: str, request: dict, resolved: dict) -> dict` — implements `ph()`;
render #0 (empty resolved) emits `<<path>>`; a full `resolved` map yields a resolved payload; exposes
`unresolved(doc) -> list[str]` (remaining `<<…>>` paths).
- [ ] **Step 1: Failing test** — using the design §6 `build-json.j2`: render with `{}` → payload has
  `<<mapping.children.network.outputs.subnet_id>>`; render with the full resolved map → concrete
  values; `unresolved()` returns the right paths; a value that never resolves is reported (not
  silently dropped).
- [ ] Steps 2–4: implement; pass. [ ] Commit `feat(fn): jinja render/resolve engine`.

### Task 2: `fn-api-call` + secretRef resolution
**Files:** Create `runtime/fn/api_call.py`, `runtime/tests/test_api_call.py`
**Interfaces:** `call(method, url, body, headers, secret_refs) -> {status, response}`; a `secretRef`
value resolves from a cluster Secret (injected/mocked in tests), never logged or echoed into outputs.
- [ ] Failing test (mocked transport: correct request shape; a `secretRef` header resolves to the
  secret value at call time and is absent from the returned/ logged data) → fail → implement → pass →
  commit `feat(fn): api-call + secretRef`.

### Task 3: `fn-json-extractor` + `fn-set-value`
**Files:** Create `runtime/fn/json_extract.py`, `runtime/fn/set_value.py`, tests
**Interfaces:** `extract(source, rules) -> dict` (JSONPath per rule); `set_value(expr, args) -> value`.
- [ ] Failing test (extract `$.items[0].id` from a fixture response → `{account_id: ...}`; missing path
  → clear error; set_value computes a simple transform) → fail → implement → pass → commit
  `feat(fn): json-extractor + set-value`.

### Task 4: `fn-git-commit` (sole Git writer)
**Files:** Create `runtime/fn/git_commit.py`, `runtime/tests/test_git_commit.py`
**Interfaces:** `commit(repo, path, content, identity) -> sha` — commits the resource JSON to Git (a
local fixture bare repo in tests); this is where the runtime write to Git happens.
- [ ] Failing test (commit writes the file + returns a sha against a fixture repo) → fail → implement →
  pass → commit `feat(fn): git-commit`.

### Task 5: Argo WorkflowTemplate wrappers + runner image
**Files:** Create `runtime/argo/fn-*.yaml`, `runtime/Dockerfile`, `runtime/tests/test_manifests.py`
**Interfaces:** Each `fn-*.yaml` is a WorkflowTemplate whose `run` template invokes the runner image
with params matching the CB01 manifest; the image bundles `runtime/fn/*`.
- [ ] Failing test (each `fn-*.yaml` parses as valid WorkflowTemplate YAML with params matching its
  manifest; `docker build` of the runner succeeds) → fail → implement → pass → commit
  `feat(fn): argo wrappers + runner image`. (Live end-to-end against a real Argo cluster: DEFERRED,
  skipif-gated.)

## Env vars used
`ARTIFACT_S3_*` / Git write credential for `fn-git-commit` (runtime, per E06/inputs); secret backend
for `fn-api-call`.

## Exit / DoD
The five `fn-*` blocks exist as unit-tested Python + valid WorkflowTemplate wrappers; `fn-jinja-render`
exactly implements the §6 wave resolution; `fn-git-commit` is the runtime Git writer; `fn-api-call`
resolves secrets by reference. Live-Argo execution of a full generated service template is the final
integration step, deferred to a cluster.
