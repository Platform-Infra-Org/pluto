# Platform (new-ui)

An internal developer platform built as a **Backstage plugin suite** — self-service
resource requests with approval, Argo-backed provisioning, per-team RBAC, a
service/graph builder, and a shadcn design system, with identity from LDAP.

> **Docs:** the full documentation (Diátaxis: tutorials / how-to / reference /
> explanation) is served **inside Backstage** via TechDocs — open the
> **Platform Plugin Suite** component → **Docs** tab, or `/docs`. Source lives in
> `deploy/backstage/seed/catalog/platform-docs/`.

## Repository layout

```
backstage/                     The Backstage app (the product)
  packages/app                 Frontend app shell (features wired in App.tsx)
  packages/backend             Backend (plugins/modules wired in index.ts)
  plugins/                     The 8 platform plugins (see below)
  app-config*.yaml             Config (dev + production split)

deploy/                        Local dev infrastructure + seed data
  backstage/docker-compose.yml Postgres, Keycloak, OpenLDAP, Gitea, MinIO
  backstage/kind-argo-up.sh    kind cluster + Argo Workflows + git-ops
  backstage/argo/              Argo WorkflowTemplates (git-ops, function-blocks)
  backstage/seed/catalog/      Catalog Git repo: resources + the docs component
  backstage/seed/software-templates/  Templates Git repo
  keycloak/                    Realm (OIDC + LDAP federation)
  ldap/                        OpenLDAP bootstrap LDIF (users + groups)

docs/                          Repo-level docs (specs, plans, prod, upgrade)
scripts/                       dev-up / backstage-up helpers
apps/, runtime/, planning/     Legacy pre-Backstage stack + composable-builder design
```

## The plugins (`backstage/plugins/`)

| Package | What it is |
|---|---|
| `platform-common` | shared types |
| `platform-requests-backend` | requests: store, state machine, Argo client, resolvers, notifications, router |
| `platform-requests` | frontend pages + Resource entity cards/tab |
| `platform-ui` | shadcn design system, colour picker, nav, DynamicSelect, JsonTree |
| `scaffolder-backend-module-platform-actions` | the `platform:request:submit` action |
| `platform-builder-backend` / `platform-builder` | the service/graph builder |
| `permission-backend-module-platform-rbac` | the RBAC permission policy |

Each plugin keeps one responsibility per file (`store.ts`, `stateMachine.ts`,
`argo.ts`, `resolvers`-style helpers, `notifications.ts`, `router.ts`), with
`migrations/` and `config.d.ts` where relevant.

## Run it locally

See **[README-RUN.md](README-RUN.md)**. In short: `docker compose -p backstage -f
deploy/backstage/docker-compose.yml up -d`, `bash deploy/backstage/gitea-seed.sh`,
`bash deploy/backstage/kind-argo-up.sh`, then `cd backstage && yarn start`. Log in
with an LDAP account (`admin`/`admin`, `sam`/`sam`).

## Production & upgrades

- **[docs/PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md)** — what to change
  for production (this is a local demo instance).
- **[docs/UPGRADING-BACKSTAGE.md](docs/UPGRADING-BACKSTAGE.md)** — how to bump
  Backstage without breaking the customization.
