# Reference: configuration keys

App-config keys the suite reads (all under `app-config.yaml` unless noted).

## `platform.rbac`

```yaml
platform:
  rbac:
    adminGroups: [group:default/platform-admins]     # default
    auditorGroups: [group:default/platform-auditors]  # default
```
Frontend-visible (the approve button uses `adminGroups`). Multiple groups allowed.

## `platform.argo`

```yaml
platform:
  argo:
    baseUrl: http://localhost:2746   # direct argo-server (dev)
    namespace: argo
    defaultTemplate: demo-resource
    proxyPath: /argo-workflows       # optional — route calls through the proxy
```
Set `proxyPath` to a `proxy.endpoints` entry to send Argo calls through the
Backstage proxy (which injects the argo-server auth server-side, with a service
token). Unset = direct `baseUrl`.

## `platform.home`

```yaml
platform:
  home:
    title: Welcome
    subtitle: …
    sections: [quickActions, ownedResources, standingRequests, pendingApprovals]
    maxItems: 8
```
Frontend-visible. Configures the home page cards; omit for all sections.

## `platform.builder` / `platform.catalog`

Gitea coordinates the builder publishes to / the catalog repo (baseUrl, owner,
repo, user, password). Replace with real VCS + tokens for production.

## `catalog.providers.ldapOrg`

The LDAP ingestion (users + groups). Target, bind, user/group search + mapping,
and a `schedule`. See **[Identity & LDAP](../explanation/identity-and-ldap.md)**.

## `proxy.endpoints`

Server-side proxy routes (e.g. `/demo-options` for DynamicSelect, `/argo-workflows`
for Argo). Inject upstream auth here so secrets never reach the browser/plugin.

## Auth

`auth.providers.oidc` (Keycloak), `auth.session.secret`. See
**[Production Readiness](../../..)** (repo `docs/PRODUCTION-READINESS.md`) for the
must-externalize list.
