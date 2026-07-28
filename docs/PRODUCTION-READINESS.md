# Production Readiness — Audit & Checklist

**Status: this repo is a self-contained local *reference/demo* instance, not a
production deployment.** It boots the whole platform (Backstage + Keycloak +
OpenLDAP + Gitea + Argo-on-kind + Postgres) on one machine with **throwaway
dev-only credentials**, by design, so it runs out of the box. Going to
production is a configuration + infrastructure exercise, not a code rewrite —
the plugin code itself is production-shaped. This document is the audit and the
checklist to get there.

## Development remnants found & cleaned

- **`.spa.log`** — the SPA dev-server log was tracked in git. Removed from
  tracking and added to `.gitignore`. (All other runtime logs/pids/caches —
  `.bff.log`, `.argo-pf.*`, `.catalog-*`, `__pycache__`, `dist/` — were already
  ignored.)
- No `console.log` / `debugger` / `TODO` / `FIXME` in the plugin source.
  `ponytail:` comments are deliberate design notes, not debt.

## Must change for production (config + infra, not code)

### 1. Secrets — externalize everything
The base `app-config.yaml` carries **inline dev secrets** (intentional, for the
demo). Production loads `app-config.production.yaml` *on top*; move every secret
there as an `${ENV_VAR}` reference and inject via your secret manager. The full
list to externalize:

| Config key | Dev value (in app-config.yaml) | Production |
|---|---|---|
| `backend.auth.externalAccess[].options.token` | `dev-smoke-token-please-change` | remove, or a strong `${…}` secret (this is a static backend bearer token) |
| `auth.session.secret` | `dev-only-backstage-session-secret` | `${AUTH_SESSION_SECRET}` |
| `auth.providers.oidc.*.clientSecret` | `backstage-dev-secret` | `${OIDC_CLIENT_SECRET}` |
| `backend.database.connection.password` | `backstage` | `${POSTGRES_PASSWORD}` (already done in prod config) |
| `platform.builder.gitea.password` / `platform.catalog.gitea.password` | `platform` | real VCS token (`${…}`) |
| `catalog.providers.ldapOrg.default.bind.secret` | `admin` | `${LDAP_BIND_SECRET}` |
| `proxy.endpoints./demo-options.headers.Authorization` | `Bearer dev-smoke-token…` | the upstream API's real key (`${…}`) |

### 2. Auth
- **Remove the `guest` provider** — it's an auth bypass. Present in both
  `app-config.yaml` and `app-config.production.yaml`; delete it for prod.
- Set **`auth.environment: production`** and add a `production:` block under the
  `oidc` provider (the demo only defines `development:`).
- Add **`auth.providers.oidc.*.signIn.resolvers`** and
  `backend.auth.dangerouslyDisableDefaultAuthPolicy` must stay **unset**.
- The OIDC resolver (`emailLocalPartMatchingUserEntityName`) assumes email
  local-part == the LDAP `uid`. Confirm that holds in your real directory, or
  switch to a resolver keyed on a stable claim.

### 3. Integrations — replace the local demo services
Every integration currently points at a local dev service. For production:
- **VCS**: the local **Gitea** (`localhost:3001`, basic-auth `platform/platform`)
  → real GitHub/GitLab, token-authed. The catalog + templates repos and the
  scaffolder/git-ops write path all use it.
- **Identity**: local **Keycloak** + **OpenLDAP** → your real IdP + directory
  (the LDAP federation + `catalog.providers.ldapOrg` config carry over; just
  repoint `target`/`connectionUrl`, use LDAPS, and a real bind secret).
- **Argo**: **kind** + a plain-HTTP port-forward on `:2746` → a real Argo
  Workflows cluster. Auth is supported: set **`platform.argo.proxyPath`** to a
  `proxy.endpoints` entry (e.g. `/argo-workflows`) that targets the real
  argo-server and injects the token/mTLS server-side; the ArgoClient then routes
  all calls through the proxy with a service token. Leave `proxyPath` unset only
  for the dev argo-server (`--auth-mode=server --secure=false`).
- **`host.docker.internal`** in `git-ops.yaml` (pod→host Gitea reachability) is a
  Docker-Desktop-only shim → an in-cluster Service URL for the real VCS.
- **TLS everywhere** (backend baseUrl, OIDC, LDAP, Argo, VCS) and a real
  `app.baseUrl`/`backend.baseUrl` (not `localhost:7007`).

### 4. Hardening
- `backend.reading.allow` currently allows `localhost:3001`; scope it to the
  real hosts.
- Argo submit/status/output reads (`argo.ts`) need auth headers in prod.
- The static `externalAccess` token is used by seed scripts / smoke tests only —
  drop it or rotate it.

## What is already production-shaped (no change needed)

- The **plugin suite** (native TS, new frontend/backend systems), the
  **per-team RBAC** (LDAP-group-driven), the **request/approval state machine**,
  **completion-gated Argo tracking**, **notifications**, the **workflow-is-the-
  sole-Git-writer** model, and the **config-driven** admin/auditor groups,
  home page, and `argoSubmit`/`resource-data` conventions.
- Test coverage: the requests-backend + builder-backend suites (`yarn tsc` +
  `yarn test`) are the regression gate.

## Quick pre-prod checklist
- [ ] All secrets in `app-config.production.yaml` as `${ENV}`; nothing sensitive in `app-config.yaml`.
- [ ] `guest` provider removed; `auth.environment: production`; OIDC `production` block.
- [ ] Real Gitea/GitHub, Keycloak/IdP, LDAP (LDAPS), Argo (TLS+auth) endpoints.
- [ ] `platform.argo.proxyPath` set to a proxy endpoint that injects Argo auth.
- [ ] `host.docker.internal` → in-cluster Service in `git-ops.yaml`.
- [ ] TLS + real base URLs; `backend.reading.allow` scoped.
- [ ] `yarn tsc` + `yarn test` green; smoke: login (LDAP), request→approve→workflow, edit/delete, Resource Data tab.
