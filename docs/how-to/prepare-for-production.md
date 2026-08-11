# How-to: prepare for production

This repo boots the whole platform — Backstage, Keycloak, OpenLDAP, Gitea,
Argo-on-kind, Postgres — on one machine with **throwaway dev credentials**, by
design, so it runs out of the box. Going to production is a configuration and
infrastructure exercise, not a code rewrite: the plugin code is already
production-shaped.

Production loads `app-config.yaml` **and** `app-config.production.yaml` on top,
so anything you set in the production file wins.

## 1. Externalise every secret

The base config carries inline dev secrets on purpose. Move each to an
`${ENV_VAR}` reference in `app-config.production.yaml` and inject it from your
secret manager.

| Config key | Dev value | Production |
|---|---|---|
| `backend.auth.externalAccess[].options.token` | generated into `app-config.local.yaml` (gitignored) | absent entirely, or a strong `${…}` — it is a static bearer token |
| `auth.session.secret` | generated into `app-config.local.yaml` (gitignored) | `${AUTH_SESSION_SECRET}` |
| `auth.providers.oidc.*.clientSecret` | `backstage-dev-secret` | `${OIDC_CLIENT_SECRET}` |
| `backend.database.connection.password` | `backstage` | `${POSTGRES_PASSWORD}` (already done in the production file) |
| `catalog.providers.ldapOrg.default.bind.secret` | `admin` | `${LDAP_BIND_SECRET}` |
| `platform.secrets.encryptionKey` | unset (dev sets a throwaway locally) | `${PLATFORM_SECRET_KEY}` — see [secret lifecycle](../explanation/secrets-lifecycle.md) |
| `proxy.endpoints./demo-options.headers.Authorization` | `Bearer dev-smoke-token…` | the upstream API's real key |

## 2. Auth

- **Remove the `guest` provider — with `null`, not by omission.**

  ```yaml
  auth:
    providers:
      guest: null
  ```

  Backstage **merges** config objects across files: a production file that
  simply leaves `guest` out inherits it from `app-config.yaml`, and the guest
  provider is an auth bypass. Only `null` removes a key.

  Verified against `@backstage/config`: with the key omitted,
  `auth.providers` reports `["oidc","guest"]` and guest is readable; with
  `guest: null` it reports `["oidc"]`.
- Set `auth.environment: production` and add a `production:` block under the
  `oidc` provider — the demo only defines `development:`.
- Leave `backend.auth.dangerouslyDisableDefaultAuthPolicy` **unset**.
- The sign-in resolver (`emailLocalPartMatchingUserEntityName`) assumes the email
  local part equals the LDAP `uid`. Confirm that holds in your directory, or
  switch to a resolver keyed on a stable claim.

## 3. Replace the local demo services

- **Git.** Dev uses Gitea on `localhost:3001`; production uses Bitbucket Data
  Center, already wired in `app-config.production.yaml` via
  `integrations.bitbucketServer` and the `catalog.locations` entries. That covers
  **reads**. The **write** path is the `git-ops` Argo workflow — point its
  `repoUrl` parameter at the real repo and give `creds` an account with push
  access.
- **`host.docker.internal`** in `git-ops.yaml` is a Docker-Desktop shim for
  reaching Gitea on the host. In a real cluster, use the VCS's real URL.
- **Identity.** Local Keycloak + OpenLDAP → your IdP and directory. The
  federation and `catalog.providers.ldapOrg` config carry over; repoint
  `target`/`connectionUrl`, use LDAPS, and a real bind secret. If your catalog
  ingests into a namespace other than `default`, set `platform.catalog.namespace`
  to match — resource links and requester notifications are built from it.
- **Argo.** kind plus a plain-HTTP port-forward on `:2746` → a real Argo
  Workflows cluster. Set `platform.argo.proxyPath` to a `proxy.endpoints` entry
  that targets the real argo-server and injects the token or mTLS **server-side**;
  the client then routes everything through the proxy. Leave `proxyPath` unset
  only for a dev argo-server running `--auth-mode=server --secure=false`.
- **TLS everywhere**, and real `app.baseUrl` / `backend.baseUrl` values instead
  of `localhost:7007`.

## 4. Hardening

- Scope `backend.reading.allow` to the real hosts (production already points it
  at the Bitbucket host).
- Give the backend's Kubernetes service account only `create` and `delete` on
  Secrets in the workflow namespace — it never reads them back.
- Drop or rotate the static `externalAccess` token; it exists for seed scripts
  and smoke tests.

## What already needs no change

The plugin suite itself, per-team RBAC driven by LDAP groups, the
request/approval state machine, completion-gated Argo tracking, notifications,
the workflow-owns-Git model, and the config-driven admin/auditor groups, home
page and `argoSubmit` / `resource-data` conventions.

## Pre-flight checklist

- [ ] Every secret in `app-config.production.yaml` as `${ENV}`; nothing sensitive in `app-config.yaml`
- [ ] `guest` provider removed; `auth.environment: production`; OIDC `production` block present
- [ ] Bitbucket reads configured; `git-ops` `repoUrl` + `creds` point at the real repo
- [ ] `host.docker.internal` replaced
- [ ] IdP, LDAPS and Argo (TLS + auth) endpoints real; `platform.argo.proxyPath` set
- [ ] TLS and real base URLs; `backend.reading.allow` scoped
- [ ] `platform.secrets.encryptionKey` set from the secret manager
- [ ] A retention policy decided: either `platform.requests.retention.enabled`
      with windows that suit your compliance position, or a deliberate choice to
      keep every request forever
- [ ] `yarn tsc`, `yarn lint:all` and `yarn test` green
- [ ] Smoke: LDAP login, request → approve → workflow, edit, delete, Resource Data tab
