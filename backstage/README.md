# Platform on Backstage

A Backstage instance + plugin suite for the internal developer platform. This is
the TypeScript successor to the legacy `apps/` SPA+BFF (kept on `main` for
fallback). Built on the `backstage-plugins` branch.

## Prerequisites

- Node 22, Docker (running), `kubectl`, `helm`. `kind` is installed automatically
  by the up-script if missing.

## Run it (readymade instance)

From the repo root:

```bash
# 1. Bring up the stack: docker services + seeded Gitea repos + kind/Argo cluster.
scripts/backstage-up.sh

# 2. Start Backstage (frontend :3000 + backend :7007).
cd backstage && yarn install && yarn start
```

Then open http://localhost:3000 and sign in with Keycloak (users:
`admin`/`admin`, `requester`/`requester`, `auditor`/`auditor`).

Tear everything down with:

```bash
scripts/backstage-down.sh
```

## What's running

| Service     | URL                     | Notes                                   |
|-------------|-------------------------|-----------------------------------------|
| Backstage   | http://localhost:3000   | backend on :7007                        |
| Keycloak    | http://localhost:8081   | realm `platform`, admin/admin           |
| Gitea       | http://localhost:3001   | `platform/catalog`, `platform/software-templates` (platform/platform) |
| MinIO       | http://localhost:9002   | console :9003, minioadmin/minioadmin    |
| argo-server | http://localhost:2746   | port-forwarded from the kind cluster    |

Distinct ports let this coexist with the legacy stack (`scripts/dev-up.sh`).

## Layout

- `packages/app` — frontend (custom theme, OIDC sign-in, module wiring).
- `packages/backend` — backend (OIDC provider, Postgres, catalog, scaffolder).
- `plugins/` — the platform plugin suite (added in P1+).
- Stack + seed assets live in `../deploy/backstage/`; orchestration in
  `../scripts/backstage-{up,down}.sh`.

## Status

- **P0 (done):** bootable shell — create-app, custom theme, Keycloak OIDC, Gitea
  repos, kind + Argo, catalog ingesting the platform resources.
- **P1+:** requests/approvals backend, Scaffolder spine, graph builder, resource
  edit/delete, Argo status. See `../docs/superpowers/plans/`.
