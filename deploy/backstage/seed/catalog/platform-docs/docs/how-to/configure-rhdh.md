# How to configure the suite in Red Hat Developer Hub 1.9

This installs the platform plugin suite into a running **RHDH 1.9** (Backstage
1.45.3) instance **by config only** — no app rebuild. It assumes the OCI images
already exist; building them is covered by the repo's RHDH 1.9 migration plan
(`docs/RHDH-1.9-MIGRATION.md`), not this guide.

## Before you start

- RHDH **1.9** deployed (Operator or Helm).
- The suite's OCI images pushed to a registry RHDH can pull (`oci://<registry>/…`),
  built against the 1.45.3-pinned context.
- The RHDH-provided dynamic plugins we depend on are available in your install:
  LDAP catalog module, OIDC auth, permission backend, notifications, scaffolder,
  techdocs. You **enable** these — you don't ship them.

RHDH reads two things: a **`dynamic-plugins`** ConfigMap (which plugins to load +
their `pluginConfig`) and the **app-config** ConfigMap (auth, integrations,
proxy). With the Operator both are referenced from the `Backstage` CR; with Helm
they're `global.dynamic` / `upstream.backstage.appConfig`.

## 1. Enable the plugins (`dynamic-plugins.yaml`)

Replace `REGISTRY`, `ORG`, and the `:0.1.0` tags with yours. `!<pkg-name>` after
the tag is the OCI image's exported package.

```yaml
plugins:
  # --- backend plugins (new backend system; zero source change from dev) ---
  - package: oci://REGISTRY/ORG/platform-requests-backend:0.1.0!internal-backstage-plugin-platform-requests-backend
    disabled: false
    pluginConfig:
      platform:
        argo:
          baseUrl: https://argo-server.argo.svc.cluster.local:2746
          namespace: argo
          defaultTemplate: demo-resource
          proxyPath: /argo-workflows      # inject argo auth server-side (see §2)
        rbac:
          adminGroups: ['group:default/platform-admins']

  - package: oci://REGISTRY/ORG/scaffolder-backend-module-platform-actions:0.1.0!internal-backstage-plugin-scaffolder-backend-module-platform-actions
    disabled: false

    disabled: false

  - package: oci://REGISTRY/ORG/permission-backend-module-platform-rbac:0.1.0!internal-backstage-plugin-permission-backend-module-platform-rbac
    disabled: false
    pluginConfig:
      permission:
        enabled: true
      platform:
        rbac:
          adminGroups: ['group:default/platform-admins']
          auditorGroups: ['group:default/platform-auditors']

  # --- frontend plugin (Scalprum; registered via mount points, NOT Blueprints) ---
  - package: oci://REGISTRY/ORG/platform-requests:0.1.0!internal-plugin-platform-requests
    disabled: false
    pluginConfig:
      dynamicPlugins:
        frontend:
          internal.plugin-platform-requests:
            dynamicRoutes:
              - path: /requests
                importName: RequestsPage
                menuItem: { text: Requests, icon: category }
              - path: /platform-home
                importName: HomePage
            apiFactories:
              - importName: requestsApiFactory
            mountPoints:
              - mountPoint: entity.page.overview/cards
                importName: ResourceActionsCard
                config:
                  layout: { gridColumn: '1 / -1' }
                  if: { allOf: [{ isKind: resource }] }
              - mountPoint: entity.page.overview/cards
                importName: RelationsCard
                config:
                  if: { allOf: [{ isKind: resource }] }
            entityTabs:
              - path: /resource-data
                title: Resource Data
                mountPoint: entity.page.resource-data
            scaffolderFieldExtensions:
              - importName: DynamicSelectFieldExtension

  # --- RHDH-provided plugins we depend on: enable, don't ship ---
  - package: ./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-ldap-dynamic
    disabled: false
    pluginConfig:
      catalog:
        providers:
          ldapOrg:
            default:
              target: ldap://openldap.platform.svc.cluster.local:389
              bind: { dn: 'cn=admin,dc=platform,dc=io', secret: '${LDAP_BIND_SECRET}' }
              users: { dn: 'ou=people,dc=platform,dc=io', options: { filter: '(objectClass=inetOrgPerson)' } }
              groups: { dn: 'ou=groups,dc=platform,dc=io', options: { filter: '(objectClass=groupOfNames)' } }
              schedule: { frequency: { minutes: 30 }, timeout: { minutes: 3 } }
```

The `importName` values (`RequestsPage`, `ResourceActionsCard`, …) are the named
exports from the frontend plugin's RHDH build (migration plan Phase 3). If a
card or route doesn't appear, an `importName` mismatch is the first suspect.

## 2. App-config additions

Add to the RHDH app-config ConfigMap. The Argo **proxy** is what keeps the
argo-server token server-side (never in the browser or a plugin param):

```yaml
proxy:
  endpoints:
    /argo-workflows:
      target: https://argo-server.argo.svc.cluster.local:2746
      changeOrigin: true
      secure: true
      headers:
        Authorization: 'Bearer ${ARGO_SERVER_TOKEN}'   # from a mounted Secret

auth:
  environment: production
  providers:
    oidc:
      production:
        metadataUrl: ${OIDC_METADATA_URL}
        clientId: ${OIDC_CLIENT_ID}
        clientSecret: ${OIDC_CLIENT_SECRET}
        prompt: auto
```

Every `${…}` resolves from env, backed by a Kubernetes Secret — no secrets in
the ConfigMap. `platform.argo.proxyPath: /argo-workflows` (set in §1) makes the
requests backend route Argo calls through this proxy.

## 3. Apply and verify

- **Operator:** update the `dynamic-plugins` ConfigMap + app-config referenced by
  the `Backstage` CR; the Operator's init-container reloads plugins on rollout.
- **Helm:** set `global.dynamic.plugins` (or the plugins ConfigMap) and
  `upstream.backstage.appConfig`; `helm upgrade`.

Then check:

1. RHDH pod logs show each plugin **loaded** (grep the package names); no
   Scalprum/backend-manager load errors.
2. **Requests** appears in the sidebar; `/requests` renders the three tabs.
3. Open a `Resource` entity → the **Manage** + **Relations** cards and the
   **Resource Data** tab appear (the `if: isKind: resource` mount points).
4. A scaffolder template shows the **DynamicSelect** field.
5. End to end: submit a request → approve → the `git-ops` workflow runs → the
   request reaches **SUCCEEDED** with the result link.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Plugin missing from sidebar | `importName`/`dynamicRoutes` mismatch, or image tag wrong |
| Card/tab absent on a resource | `mountPoint` name or `if: isKind` condition wrong |
| Argo calls 401 in logs | `ARGO_SERVER_TOKEN` Secret unset, or `proxyPath` not set on the backend |
| No LDAP users/groups | `catalog.providers.ldapOrg` DNs/filters, or `LDAP_BIND_SECRET` |
| Approvals not gated | `permission.enabled: true` missing, or `adminGroups` ref wrong |

For the design behind these keys, see **Per-team RBAC**, **Identity & LDAP**, and
**Workflows own Git** in Explanation.
