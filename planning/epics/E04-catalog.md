# E04 — Resource Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. `- [ ]` steps.

**Goal:** Pull the Git repo of resource JSONs, index it into Postgres, and let a user browse *their*
resources (RBAC + ownership filtered) with detail + raw view + Git history.

**Architecture:** A **Git sync worker** clones/pulls the repo (webhook + periodic reconcile), parses
& validates each JSON against its resource-type schema, and upserts a catalog **index** row. The
index is a rebuildable cache; Git stays authoritative and **read-only from the app**. The catalog API
filters by the caller's `Principal` (E02). **[D]**

**Tech Stack:** GitPython/pygit2 (read-only), FastAPI, SQLAlchemy, TanStack Table (SPA).

## Global Constraints
App never writes Git. Visibility enforced in BFF queries, not just UI. See README.

## File structure
- `apps/bff/app/catalog/git_sync.py` — pull + walk + parse
- `apps/bff/app/catalog/index.py` — upsert/query the index
- `apps/bff/app/catalog/ownership.py` — resolve `owner_team`
- `apps/bff/app/models/resource.py` — `ResourceIndex` table
- `apps/bff/app/api/catalog.py` — `GET /api/resources`, `GET /api/resources/{id}`, `/raw`, `/history`, `POST /api/git/webhook`
- `apps/web/src/app/routes/resources/*` — list + detail
- tests under `tests/catalog/`

---

### Task 1: `ResourceIndex` model + migration
**Files:** Create `app/models/resource.py`, migration, `tests/catalog/test_model.py`
**Interfaces:** Produces `ResourceIndex(id, type, name, owner_team, git_path, git_sha, payload:jsonb,
status, updated_at)`; unique on `(type, name)`.
- [ ] Failing test (insert+query round-trips jsonb) → run(fail) → implement+migration → run(pass) →
  commit `feat(catalog): resource index model`.

### Task 2: Ownership resolution
**Files:** Create `app/catalog/ownership.py`, `tests/catalog/test_ownership.py`
**Interfaces:** Produces `resolve_owner_team(payload: dict, git_path: str) -> str` by precedence:
`metadata.ownerTeam` → path/prefix map (config) → default. **[D]**
- [ ] Failing test (all three precedence branches) → fail → implement → pass → commit
  `feat(catalog): ownership resolution`.

### Task 3: Git sync worker (pull → parse → upsert)
**Files:** Create `app/catalog/git_sync.py`, `app/catalog/index.py`, `tests/catalog/test_git_sync.py`
+ a fixture bare repo.
**Interfaces:** Produces `async sync_repo() -> SyncReport(indexed, invalid, deleted)`; validates each
JSON against its type schema, marks invalid ones `status=invalid` (surfaced, not dropped); deletes
index rows whose files vanished. Reads `GIT_REPO_URL`, `GIT_BRANCH`, `GIT_READ_TOKEN`.
- [ ] **Step 1: Failing test** — point at a fixture repo with 2 valid + 1 invalid JSON; after
  `sync_repo`, index has 2 active + 1 invalid, correct `git_sha`, resolved owner teams.
- [ ] Steps 2–4: implement clone/pull + walk + validate + upsert; test passes.
- [ ] Commit `feat(catalog): git sync worker`.

### Task 4: Webhook + periodic reconcile
**Files:** Modify `app/api/catalog.py` (`POST /api/git/webhook`), add scheduler
**Interfaces:** Produces webhook endpoint verifying `GIT_WEBHOOK_SECRET` → triggers `sync_repo`; a
periodic job (e.g. every 5 min) as fallback.
- [ ] Failing test (bad signature → 401; good → triggers sync) → fail → implement → pass → commit
  `feat(catalog): git webhook + reconcile`.

### Task 5: Catalog API (RBAC-filtered)
**Files:** Modify `app/api/catalog.py`, `tests/catalog/test_api.py`
**Interfaces:** Produces `GET /api/resources?type=&q=&page=` (filtered to caller's teams unless
admin/auditor), `GET /api/resources/{id}`, `.../raw` (reads file at sha), `.../history` (git log).
- [ ] **Step 1: Failing test** — requester sees only their team's resources; admin sees all; detail
  returns parsed + raw.
- [ ] Steps 2–4: implement; enforce visibility in the SQL query (E02 `Principal`). Pass.
- [ ] Commit `feat(catalog): rbac-filtered catalog api`.

### Task 6: SPA — My Resources list + detail
**Files:** Create `src/app/routes/resources/list.tsx`, `detail.tsx`, tests
**Interfaces:** Consumes catalog API via TanStack Query; renders TanStack Table (sort/filter),
detail with fields + raw JSON + history + any in-flight request badge (later linked by E05).
- [ ] Failing test (list renders rows; filter narrows) → fail → implement → pass → commit
  `feat(web): resource list + detail`.

## Env vars used
`GIT_REPO_URL`, `GIT_BRANCH`, `GIT_READ_TOKEN`, `GIT_WEBHOOK_SECRET` (inputs §3).

## Blocks on inputs
§3 repo URL/layout/token/owner-team source/webhook; sample resource JSONs (§8).

## Exit / DoD
A push to the repo re-indexes within minutes; a requester browsing the catalog sees exactly their
team's resources with correct fields, raw JSON, and history; invalid files are flagged, not hidden.
