# How-to: deploy to Kubernetes with Helm

The chart is `deploy/prod/helm/platform`. It deploys the portal and nothing else —
production supplies its own Postgres, directory, SSO and Bitbucket.

## What the chart does and does not create

| Creates | Does not create |
|---|---|
| Deployment, Service, Ingress | Postgres — you supply the host and credentials |
| ServiceAccount + Role/RoleBinding for per-request Secrets | The Secret holding credentials (unless you enable ESO) |
| ConfigMap with the rendered `app-config.production.yaml` | Argo Workflows, the IdP, the directory, Bitbucket |
| PodDisruptionBudget, optional ExternalSecret | Namespaces |

## 1. Provide the credentials

The chart never templates a secret value. It references one Secret, by name:

```yaml
secrets:
  existingSecret: platform-prod-secrets
```

with these keys (rename them in `secrets.keys` to match a Secret you already
have rather than copying data around):

| Key | Used for |
|---|---|
| `POSTGRES_PASSWORD` | the external database |
| `OIDC_CLIENT_SECRET` | SSO client secret |
| `AUTH_SESSION_SECRET` | signs the session cookie |
| `LDAP_BIND_SECRET` | AD bind account |
| `BITBUCKET_TOKEN` | reading catalog + template repos |
| `ARGO_TOKEN` | submitting workflows, injected by the proxy server-side |
| `PLATFORM_SECRET_KEY` | envelope key for per-request secrets |

Either create that Secret yourself, or let External Secrets Operator sync it:

```yaml
secrets:
  externalSecrets:
    enabled: true
    secretStoreRef: { name: vault-prod, kind: ClusterSecretStore }
    data:
      - secretKey: POSTGRES_PASSWORD
        remoteRef: { key: platform/prod/postgres, property: password }
```

The Deployment reads the same Secret either way, so switching between the two
changes nothing about the pod.

## 2. Point it at your infrastructure

```yaml
ingress:
  host: platform.acme.internal

postgres:
  host: pg-prod.acme.internal
  user: backstage_app
  database: backstage
  sslMode: verify-full
  caCertSecret: pg-ca      # mounted, and referenced as the driver's CA

oidc:
  metadataUrl: https://sso.acme.com/adfs/.well-known/openid-configuration
  clientId: platform-portal

ldap:
  target: ldaps://ad.acme.com:636
  bindDn: "CN=svc-backstage,OU=Service,DC=acme,DC=com"
  users: { dn: "OU=People,DC=acme,DC=com", map: { name: sAMAccountName } }

bitbucket:
  host: bitbucket.acme.com
  project: PLAT
```

The database user needs **CREATE DATABASE**: each Backstage plugin creates its
own database on first start.

```bash
helm upgrade --install platform deploy/prod/helm/platform \
  --namespace platform --create-namespace \
  -f my-values.yaml
```

## 3. What to check afterwards

```bash
kubectl -n platform rollout status deploy/platform
kubectl -n platform logs -l app.kubernetes.io/name=platform -f
```

- **Sign-in fails with a redirect error** → your IdP does not have
  `https://<host>/api/auth/oidc/handler/frame` registered for the client.
- **Nobody has permissions** → the sign-in resolver maps an identity to a
  catalog user that LDAP ingestion has not created yet, or the name mapping
  disagrees. `ldap.users.map.name` must produce the same value the resolver
  derives from the token.
- **A request with secrets is refused** → `platform.secrets.enabled` is off, or
  the Role is in the wrong namespace: it is created in
  `platform.secrets.namespace`, which must equal `argo.namespace` because the
  Secret's `ownerReference` to the Workflow is namespace-local.

## Two production traps worth knowing

**Removing a config key requires `null`.** Backstage *merges* config files, so a
production file that simply omits `auth.providers.guest` still inherits the
guest provider — an auth bypass — from the base config. The chart sets
`guest: null`, which is what actually removes it. The same applies to anything
you try to unset via `extraAppConfig`.

**The Argo token stays server-side.** `argo.proxyPath` routes Argo calls through
the Backstage proxy, which injects the token. Clearing `proxyPath` would make
the frontend talk to Argo directly, and the token would have to be reachable
from the browser.

## Scaling

`replicaCount` is safe above 1: the backend is stateless and the scheduled tasks
coordinate through the database. A PodDisruptionBudget is created automatically
when there is more than one replica.

## Still to port before production

The **git-ops write path** — the Argo workflow that commits resources — still
targets Gitea's API. Reads work against Bitbucket with this chart's config;
writes need that workflow repointed. See
**[Prepare for production](prepare-for-production.md)**.
