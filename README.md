# Platform (new-ui)

An internal developer platform built as a **Backstage plugin suite** — self-service
resource requests with approval, Argo-backed provisioning, per-team RBAC, and a
pixel-game design system, with identity from your directory.

> **Docs:** the full documentation (Diátaxis: tutorials / how-to / reference /
> explanation) lives in `docs/`, built by the `mkdocs.yml` at the repo root. See
> [Documentation](#documentation) for the two places it's published.

## Production vs development

**The only thing you deploy to production is the Helm chart.**

```
deploy/prod/helm/platform      The production deployment. Nothing else here ships.
deploy/dev/                    Local development only — never deployed anywhere.
```

`deploy/dev/` exists to stand up the *dependencies* on a laptop: Postgres,
Keycloak, OpenLDAP, Gitea and a kind cluster running Argo. In production those
are all yours already — a real database, your SSO, your Active Directory, your
Bitbucket Data Center, your Argo — and the chart only points at them.

That means the dev credentials living in `deploy/dev/` (`admin`/`admin` LDAP
users, a Keycloak client secret, Gitea's `platform`/`platform`) are throwaway
fixtures for containers that only listen on localhost. They are not used by the
chart and have no production equivalent.

Two credentials are **not** committed even as fixtures — a static backend bearer
token and the session-signing secret. `scripts/backstage-up.sh` generates them
into `backstage/app-config.local.yaml`, which is gitignored. Both are the kind
of value that is dangerous precisely because somebody eventually copies it into
a real deployment.

| | Development | Production |
|---|---|---|
| Runs from | `deploy/dev/` + `yarn start` | `deploy/prod/helm/platform` |
| Database | Postgres in Docker | yours, external |
| Identity | Keycloak + OpenLDAP in Docker | your SSO + AD over LDAPS |
| Git | Gitea on `localhost:3001` | Bitbucket Data Center |
| Argo | kind cluster | your cluster |
| Secrets | inline in `app-config.yaml` | a Kubernetes Secret the chart references |

## Repository layout

```
backstage/                     The Backstage app (the product)
  packages/app                 Frontend app shell (features wired in App.tsx)
  packages/backend             Backend (plugins/modules wired in index.ts)
  plugins/                     The platform plugins (see below)
  app-config*.yaml             Config (dev + production split)

docs/, mkdocs.yml              The documentation site (Diátaxis)

deploy/prod/helm/platform      PRODUCTION: the Helm chart, and the only thing
                               that gets deployed for real

deploy/dev/                    DEVELOPMENT ONLY: the local stack
  docker-compose.yml           Postgres, Keycloak, OpenLDAP, Gitea
  kind-argo-up.sh              kind cluster + Argo Workflows + git-ops
  argo/                        Argo WorkflowTemplates (git-ops, review-gate, …)
  seed/catalog/                Catalog Git repo: resources + an example docs component
  seed/software-templates/     Templates Git repo
  keycloak/                    Realm (OIDC + LDAP federation)
  ldap/                        OpenLDAP bootstrap LDIF (users + groups)

scripts/                       backstage-up / backstage-down helpers
```

## Run the dev stack locally

### What you need

Docker (with Compose), Node 22 with Yarn via corepack, and `kubectl` + `kind` if
you want the Argo half. Roughly 6 GB of RAM free for the containers and the kind
cluster.

### 1. Bring up the dependencies

```bash
bash scripts/backstage-up.sh
```

That one script does four things, and you can run them individually if it fails
part-way:

| Step | What it does | On its own |
|---|---|---|
| Docker services | Postgres, Keycloak, OpenLDAP, Gitea | `docker compose -f deploy/dev/docker-compose.yml up -d` |
| Gitea seed | creates the `catalog` and `software-templates` repos and pushes `deploy/dev/seed/` into them | `bash deploy/dev/gitea-seed.sh` |
| kind + Argo | a local cluster with Argo Workflows and the WorkflowTemplates | `bash deploy/dev/kind-argo-up.sh` |
| Port-forward | Argo's API on `localhost:2746` | done by the script above |

### 2. Start the app

```bash
cd backstage
yarn install
yarn start
```

Frontend on **:3000**, backend on **:7007**. The frontend is what you open; the
backend serves the API and, in production, the built frontend too.

### 3. Sign in

Sign in with Keycloak, using one of the LDAP fixtures:

| User | Password | Can |
|---|---|---|
| `admin` | `admin` | approve anything (member of `platform-admins`) |
| `sam` | `sam` | raise requests; approve only their team's |
| `requester` | `requester` | raise requests |

### 4. Try the loop

Create → pick **Provision With Review** → fill the form → approve your own
request as `admin` → watch the workflow suspend at its review gate → read the
plan → resume it. That exercises the whole product: template, request,
approval, Argo, the mid-run gate, and completion gating.

### Tearing it down

```bash
bash scripts/backstage-down.sh      # containers + volumes
kind delete cluster --name argo     # the Argo cluster, if you made one
```

### When something is wrong

- **Login loops or 401s** — Keycloak is slow to start on first boot. Give it a
  minute and reload.
- **The catalog is empty** — the Gitea seed did not run, or ran before Gitea was
  ready. `bash deploy/dev/gitea-seed.sh` is idempotent; run it again.
- **Requests approve but never progress** — Argo is unreachable. Check the
  port-forward is alive (`curl localhost:2746`) and re-run
  `bash deploy/dev/kind-argo-up.sh`.
- **A database looks stale** — `backstage-down.sh` removes volumes, so a full
  down/up is a clean slate.

## Deploy to production

See **[How-to → Deploy to Kubernetes with Helm](docs/how-to/deploy-with-helm.md)**,
and read **[Prepare for production](docs/how-to/prepare-for-production.md)**
first — it lists what must be externalised and what is still unported.

```bash
helm upgrade --install platform deploy/prod/helm/platform \
  --namespace platform --create-namespace \
  -f my-values.yaml
```

## The plugins (`backstage/plugins/`)

| Package | What it is |
|---|---|
| `platform-common` | shared types |
| `platform-requests-backend` | requests: store, state machine, Argo client, resolvers, notifications, router |
| `platform-requests` | frontend pages + Resource entity cards/tab |
| `platform-ui` | design system, colour picker, nav, quickstart, DynamicSelect, JsonTree |
| `scaffolder-backend-module-platform-actions` | the `platform:request:submit` action |
| `permission-backend-module-platform-rbac` | the RBAC permission policy |

Each plugin keeps one responsibility per file (`store.ts`, `stateMachine.ts`,
`argo.ts`, `resolvers`-style helpers, `notifications.ts`, `router.ts`), with
`migrations/` and `config.d.ts` where relevant.

## Documentation

One Diátaxis site at the repo root — `mkdocs.yml` + `docs/` — published two
ways: to **GitHub Pages** by the `docs` workflow on every push to `main`, and
**inside Backstage** via TechDocs once this repo is registered as a catalog
location (`catalog-info.yaml` at the root carries `techdocs-ref: dir:.`).

Start with *How-to → Prepare for production* and *Upgrade Backstage*; the
*Explanation* section covers the request and secret lifecycles, per-team RBAC,
and why workflows own Git.

To preview it locally:

```bash
pip install -r docs/requirements.txt
mkdocs serve
```

`deploy/dev/seed/catalog/example-docs/` is a *separate, small* example: how
to document an application whose source you don't own (the docs live in the
catalog repo, next to the entity).
