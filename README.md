# Platform (new-ui)

An internal developer platform built as a **Backstage plugin suite** — self-service
resource requests with approval, Argo-backed provisioning, per-team RBAC, and a
shadcn design system, with identity from LDAP.

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

docs/                          Repo-level docs (specs, prod, upgrade, secrets)
scripts/                       backstage-up / backstage-down helpers
planning/                      Pre-Backstage design record (historical)
```

## The plugins (`backstage/plugins/`)

| Package | What it is |
|---|---|
| `platform-common` | shared types |
| `platform-requests-backend` | requests: store, state machine, Argo client, resolvers, notifications, router |
| `platform-requests` | frontend pages + Resource entity cards/tab |
| `platform-ui` | shadcn design system, colour picker, nav, DynamicSelect, JsonTree |
| `scaffolder-backend-module-platform-actions` | the `platform:request:submit` action |
| `permission-backend-module-platform-rbac` | the RBAC permission policy |

Each plugin keeps one responsibility per file (`store.ts`, `stateMachine.ts`,
`argo.ts`, `resolvers`-style helpers, `notifications.ts`, `router.ts`), with
`migrations/` and `config.d.ts` where relevant.

## Run it locally

```bash
bash scripts/backstage-up.sh      # docker services + Gitea seed + kind cluster with Argo
cd backstage && yarn start        # app on :3000, backend on :7007
```

Log in with an LDAP account (`admin`/`admin`, `sam`/`sam`).
`bash scripts/backstage-down.sh` tears the stack back down.

## Documentation

One Diátaxis site, `deploy/backstage/seed/catalog/platform-docs/`, published two
ways: **inside Backstage** via TechDocs (Platform Plugin Suite → Docs) and to
**GitHub Pages** by the `docs` workflow on every push to `main`.

Start with *How-to → Prepare for production* and *Upgrade Backstage*; the
*Explanation* section covers the request and secret lifecycles, per-team RBAC,
and why workflows own Git.

To preview it locally:

```bash
pip install mkdocs-techdocs-core
mkdocs serve -f deploy/backstage/seed/catalog/platform-docs/mkdocs.yml
```
