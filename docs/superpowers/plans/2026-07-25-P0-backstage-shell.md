# P0 — Bootable Backstage Shell Implementation Plan

> **For agentic workers:** Infra bootstrap. Execute inline (long-running, stateful,
> external tooling). Steps use `- [ ]` checkboxes. Each task ends with a concrete
> verification command whose output is checked before moving on.

**Goal:** A Backstage instance that boots locally with the custom theme, signs in via
Keycloak, and shows the current 6 resources in its catalog — with Gitea hosting the
two repos and a kind+Argo cluster running, ready for the spine (P1/P2).

**Architecture:** `@backstage/create-app` monorepo under `backstage/`. A docker stack
(Postgres, Keycloak, Gitea, MinIO) + a kind cluster (Argo Workflows). `scripts/backstage-up.sh`
orchestrates everything. Legacy `apps/` untouched.

**Tech Stack:** Backstage (latest stable), Node 22, yarn, TypeScript, Docker Compose,
kind, Argo Workflows, Gitea, Keycloak.

## Global Constraints

- Branch `backstage-plugins`; never modify `apps/` (fallback).
- All new code TypeScript. Backstage app lives under `backstage/`.
- Reuse the existing Keycloak realm export (`deploy/keycloak/realm-platform.json`).
- Pin Backstage + kind + Argo versions in the up-script; provide a teardown.
- The stack must be reproducible from `scripts/backstage-up.sh` alone.
- Gitea is the git host for repos `software-templates` and `catalog`; config-swappable.

---

## Task 1: Scaffold the Backstage app

**Files:** Create `backstage/` (create-app output).

- [ ] Run `npx @backstage/create-app@latest --path backstage --skip-install` (name: `platform`).
- [ ] `cd backstage && yarn install`.
- [ ] Verify: `yarn tsc` passes and `yarn build:backend` succeeds.
- [ ] Verify boot: `yarn start` serves the frontend on :3000 (kill after confirming).
- [ ] Commit: `feat(backstage): scaffold create-app shell`.

## Task 2: Bring up the docker stack (Postgres + Keycloak + Gitea + MinIO)

**Files:** Create `deploy/backstage/docker-compose.yml`; Create `scripts/backstage-up.sh`.

- [ ] Compose services: `postgres` (Backstage DB), `keycloak` (import existing realm),
  `gitea`, `minio`. Reuse ports/envs from the current `docker-compose.integration.yml`
  where sensible; keep Backstage's Postgres on a distinct port/DB.
- [ ] `scripts/backstage-up.sh` step 1: `docker compose -f deploy/backstage/docker-compose.yml up -d`
  and wait for Keycloak realm + Gitea health.
- [ ] Verify: `curl -sf localhost:8080/realms/platform` and `curl -sf localhost:3001/api/v1/version` (Gitea) both OK.
- [ ] Commit: `feat(backstage): docker stack (postgres, keycloak, gitea, minio)`.

## Task 3: Seed Gitea repos

**Files:** Create `deploy/backstage/gitea-seed.sh`; Create `deploy/backstage/seed/catalog/**`
(6 resources as `catalog-info.yaml`); Create `deploy/backstage/seed/software-templates/**`
(one demo `template.yaml` placeholder + a demo WorkflowTemplate).

- [ ] Write a converter: current `deploy/seed-catalog/resources/<type>/<name>.json` →
  Backstage `catalog-info.yaml` (`kind: Resource`, `metadata.name`, `spec.type`, owner,
  and the original payload/mapping preserved under annotations or a `spec.definition`).
- [ ] `gitea-seed.sh`: create an admin user + token via Gitea API, create repos
  `catalog` and `software-templates`, push the seed trees.
- [ ] Wire into `backstage-up.sh` (step 2).
- [ ] Verify: both repos exist with expected files via Gitea API; a `catalog-info.yaml`
  is fetchable over raw URL.
- [ ] Commit: `feat(backstage): seed gitea catalog + templates repos`.

## Task 4: kind cluster + Argo Workflows

**Files:** Create `deploy/backstage/kind-cluster.yaml`; Create `deploy/backstage/argo/*.yaml`
(seeded function-block WorkflowTemplates + one demo type WorkflowTemplate that echoes/sleeps
and commits a `catalog-info.yaml` to the Gitea catalog repo).

- [ ] `backstage-up.sh` step 3: install kind if missing (download pinned binary), create a
  cluster, install Argo Workflows (pinned manifest), expose `argo-server` on :2746.
- [ ] Apply seeded function-block WorkflowTemplates (fn-jinja-render, fn-api-call,
  fn-json-extractor) + a `demo-resource` WorkflowTemplate whose final step git-commits a
  `catalog-info.yaml` into the Gitea catalog repo.
- [ ] Verify: `kubectl get workflowtemplate -n argo` lists the seeds; a manual
  `argo submit --from workflowtemplate/demo-resource` runs to Succeeded.
- [ ] Commit: `feat(backstage): kind cluster + argo workflows + seed templates`.

## Task 5: Keycloak OIDC auth in Backstage

**Files:** Modify `backstage/app-config.yaml`, `backstage/packages/backend/src/index.ts`,
`backstage/packages/app/src/App.tsx` (sign-in page).

- [ ] Configure the OIDC auth provider against the Keycloak realm (client, issuer,
  scopes) with an identity resolver mapping the Keycloak user → Backstage identity.
- [ ] Add a `SignInPage` using the OIDC provider.
- [ ] Verify: sign in as `requester` through Keycloak and land in Backstage authenticated.
- [ ] Commit: `feat(backstage): keycloak OIDC sign-in`.

## Task 6: Catalog ingestion from Gitea

**Files:** Modify `backstage/app-config.yaml` (integrations + catalog locations),
`backstage/packages/backend/src/index.ts` (discovery if needed).

- [ ] Add a Gitea integration (host, token) and catalog locations pointing at the
  `catalog` repo (discovery via the GitHub-compatible API, or explicit `url` locations +
  periodic refresh — see design risk (a)).
- [ ] Verify: the 6 resources appear in the Backstage catalog UI as `Resource` entities.
- [ ] Commit: `feat(backstage): ingest catalog resources from gitea`.

## Task 7: Custom theme

**Files:** Create `backstage/packages/app/src/theme/platform-theme.ts`; Modify `App.tsx`
to register light/dark variants.

- [ ] Build a custom Backstage theme approximating the current palette + light/dark;
  register both as selectable themes.
- [ ] Verify: the app renders in the custom theme and the light/dark toggle works.
- [ ] Commit: `feat(backstage): custom platform theme (light/dark)`.

## Task 8: One-shot up/down scripts + docs

**Files:** Finalize `scripts/backstage-up.sh`; Create `scripts/backstage-down.sh`;
Create `backstage/README.md`.

- [ ] `backstage-up.sh` runs steps 1–3 then prints how to start Backstage (`yarn start`
  in `backstage/`) and the URLs (Backstage :3000, Keycloak :8080, Gitea :3001, argo-server :2746).
- [ ] `backstage-down.sh`: `docker compose down -v` + `kind delete cluster`.
- [ ] Verify: from a clean state, `backstage-up.sh` + `yarn start` yields a signed-in
  Backstage showing the 6 catalog resources; `backstage-down.sh` tears it all down.
- [ ] Commit: `feat(backstage): backstage-up/down orchestration + README`.

---

## Self-Review

- **Spec coverage:** P0 scope in the design §13 = create-app (T1), theme (T7), Keycloak
  (T5), Gitea+repos (T2/T3), kind+Argo (T4), catalog ingesting 6 resources (T6),
  orchestration (T8). All covered.
- **Sequencing:** T1→T2→T3→T4 build the substrate; T5/T6/T7 configure the app; T8 ties
  it together. Each has a concrete verify gate.
- **Risk hooks:** T4 bakes the workflow's git-commit-to-catalog step (design decision 9);
  T6 carries the Gitea discovery risk with a documented fallback.
