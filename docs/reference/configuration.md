# Reference: configuration keys

App-config keys the suite reads (all under `app-config.yaml` unless noted).

## `app.branding`

```yaml
app:
  branding:
    mark: /branding/trident.svg  # logo in the accent tile; also the source for the tab icon
    favicon: /branding/tab.png   # optional: pins the tab icon instead of generating it
```

Both optional and both frontend-visible. Same-origin only (`img-src 'self'
data:`). Unset `mark` falls back to the built-in glyph. Unset `favicon`, the tab
icon is generated from whichever glyph applies — configured or built-in — over
the picked accent colour, and follows the colour picker. See
**[Change the logo, favicon and title](../how-to/rebrand-the-portal.md)**.

### `app.branding.templateHeaders`

```yaml
app:
  branding:
    templateHeaders:
      dir: template-headers   # subfolder of packages/app/src/branding/
      height: 90px            # any CSS length
      position: center        # any CSS background-position
```

Optional, frontend-visible. Drop images into the folder and they become the
software-template card headers, in filename order, cycling across the cards —
image *i* on card *i mod N*. Images are cropped to fill, never squashed.
Supported: `.png` `.jpg` `.jpeg` `.webp` `.gif` `.svg`.

With **no images** the built-in pixel art is used instead, cycling three
scenes. Header text colour is chosen per image from its own brightness, not
from the accent. See
**[Change the logo, favicon and title](../how-to/rebrand-the-portal.md)**.

### `app.branding.flavour`

```yaml
app:
  branding:
    flavour: fantasy   # omit for the literal names
```

Optional, frontend-visible. `fantasy` renames **sidebar screens only** —
Requests → Quests, New Request → Summon, Catalog → Atlas.

Request **states are never renamed**, whatever this is set to. A label naming a
screen is decoration and someone who cannot find "Requests" finds it one click
later; a label naming a state is a record, and `QUEST FAILED` in an audit trail
is a support ticket.

### The potion a first-time visitor gets

```yaml
app:
  branding:
    defaultScheme: hades
```

An id from the scheme shelf. A visitor's own pick always wins — this decides the
first visit only, so setting it never overrides a choice someone has made.
Missing or unknown falls back to `obsidian`.

## `platform.rbac`

```yaml
platform:
  rbac:
    adminGroups: [group:default/platform-admins]     # default
    auditorGroups: [group:default/platform-auditors]  # default
```
Frontend-visible (the approve button uses `adminGroups`). Multiple groups allowed. See **[Configure admins & per-team approval](../how-to/configure-rbac.md)** and **[Pause the platform](../how-to/pause-the-platform.md)**.

## `platform.argo`

```yaml
platform:
  argo:
    baseUrl: http://localhost:2746   # direct argo-server (dev)
    uiUrl: http://localhost:2746     # optional — browser-reachable Argo UI
    namespace: argo
    defaultTemplate: demo-resource
    proxyPath: /argo-workflows       # optional — route calls through the proxy
```
Set `proxyPath` to a `proxy.endpoints` entry to send Argo calls through the
Backstage proxy (which injects the argo-server auth server-side, with a service
token). Unset = direct `baseUrl`.

`uiUrl` is the only frontend-visible key here, and is deliberately separate from
`baseUrl`: that one is the address the **backend** dials argo-server on —
in-cluster in production, and unset entirely when `proxyPath` is used — so it is
not a URL a browser can follow. Set `uiUrl` and a request page links its
workflow name into the Argo UI; leave it unset and the name renders as plain
text.

## `platform.catalog`

```yaml
platform:
  catalog:
    namespace: default   # default
```
Frontend-visible. The namespace this deployment's catalog entities live in —
used for **resource** refs (`resource:<ns>/<name>`), **user** refs
(`user:<ns>/<id>`, how a requester is notified) and the `/catalog/<ns>/…` links
the request pages build. One key, not one per kind: users and resources are
assumed to share a namespace.

`platform.rbac.adminGroups` / `auditorGroups` are **unaffected** — those are
full entityRefs and already carry their namespace inline
(`group:default/platform-admins`).

## `platform.home`

```yaml
platform:
  home:
    title: Welcome
    subtitle: …
    sections:
      - quickActions        # links, plus the "Take the tour" button
      - ownedResources      # resources owned by your groups
      - standingRequests    # your requests still in flight
      - pendingApprovals    # requests you may decide
      - recentlyVisited     # pages you opened, newest first
      - favouriteTemplates  # templates you starred on New Request
      - pantheon            # the Hades boon wheel — on by default
    maxItems: 8
```

Frontend-visible. `sections` is an explicit list: **a section absent from it is
not rendered**, so adding a new card means adding its key here, not just
upgrading. `maxItems` caps the table sections; recently-visited shows 5 and
favourites 6 regardless, because a longer list stops being either.

`recentlyVisited` and `favouriteTemplates` are stored per **user** in the
user-settings backend, so they follow the person across browsers and machines.
Favourites are the same stars the New Request page already writes — nothing extra to
enable. See **[Customise the home page](../how-to/customise-the-home-page.md)**.

## `platform.secrets`

`enabled`, `namespace` (where per-request Secrets and Workflows live — must match
`platform.argo.namespace`, since an `ownerReference` is namespaced),
`encryptionKey`, and `sweep` (`enabled`, `frequency`, `maxAgeHours`).

`encryptionKey` takes a string **or a list**: the first entry encrypts, every
entry is tried on decrypt, which is how the key rotates without re-encrypting
held blobs. See **[Secret lifecycle](../explanation/secrets-lifecycle.md)**.

## `platform.demoOptions`

```yaml
platform:
  demoOptions: true
```

Serves the demo option sets at `/options/:name` — the stand-in "external" API
the DynamicSelect examples reach through the `/demo-options` proxy, including
the nested `coordinate-tree` the cascading example walks.

**Off unless set**, and it should stay off in production: this is demo data
living in a production binary, so the default is the safe one and every
environment that wants it says so. The dev stack switches it on in the
gitignored `app-config.local.yaml` that `scripts/backstage-up.sh` writes. With
it off the route answers 404 naming this key, so an example that goes quiet
explains itself.

## `platform.uploads`

```yaml
platform:
  uploads:
    bucket: platform-uploads
    region: eu-west-1
    endpoint: http://localhost:9000   # optional — S3-compatible (e.g. MinIO); omit for real AWS S3
    keyPrefix: scaffolder
    maxBytes: 10485760                # 10 MiB
    allowedExtensions: ['.yaml', '.yml', '.json', '.txt', '.csv']
    urlTtlSeconds: 300
```

Backs `POST /uploads/presign`, which signs a single S3 `PutObjectCommand` for
the `ui:field: PlatformFile` scaffolder field — bytes go straight from the
browser to S3, never through Backstage. Unset (the default): the route
returns 501 rather than failing inside the AWS SDK, and `PlatformFile` reports
"not configured".

Content-Length is signed as part of the URL, so `maxBytes` is enforced by S3,
not merely advised to the browser. Content-Type is **not** taken from the
caller — it is derived server-side from the (validated) extension, so a
caller cannot sign an upload as a type the bucket would later serve as HTML.
See **[File uploads](../how-to/author-a-template.md#file-uploads)** for the
CORS, CSP and bucket-lifecycle requirements this needs on the S3 side.

## `platform.requests.retention`

Off by default — deleting rows cannot be undone.

```yaml
platform:
  requests:
    retention:
      enabled: true
      dryRun: false           # log what would go, change nothing
      frequency: { hours: 6 }
      batchSize: 500          # rows deleted per state per run
      pendingExpiryDays: 14   # PENDING_APPROVAL -> EXPIRED (0 = never)
      succeededDays: 90
      failedDays: 90
      rejectedDays: 30
      expiredDays: 30
```

Any window may be `0` to keep that state forever. `APPROVED` and `IN_PROGRESS`
are never deleted regardless of configuration. See
**[the request lifecycle](../explanation/request-lifecycle.md)**.

## `app.extensions`

Backstage's own extensions are configured here, by id. Two this suite sets:

```yaml
app:
  extensions:
    - page:catalog:
        config:
          path: /catalog
    # The catalog opens on Resource — this platform's catalog is mostly the
    # things requests create, and Component is Backstage's default.
    - catalog-filter:catalog/kind:
        config:
          initialFilter: resource
```

Every catalog filter is a separately configurable extension —
`catalog-filter:catalog/kind`, `/type`, `/mode`, `/namespace`, `/lifecycle`,
`/processing-status` and the user list — so their defaults can be changed the
same way without touching code. The catalog **page** extension does not expose
the default kind; the filter extension does, which is why the setting lives
here rather than under `page:catalog`.

## `catalog.providers.ldapOrg`

The LDAP ingestion (users + groups). Target, bind, user/group search + mapping,
and a `schedule`. See **[Identity & LDAP](../explanation/identity-and-ldap.md)**.

## `proxy.endpoints`

Server-side proxy routes (e.g. `/demo-options` for DynamicSelect, `/argo-workflows`
for Argo). Inject upstream auth here so secrets never reach the browser/plugin.

The `/infra` route feeds the cascading `DynamicSelect` example
(`provision-database`, see **[Add a DynamicSelect
field](../how-to/add-a-dynamic-select-field.md)**). It needs two env vars:

- `INFRA_CONFIG_API_URL` — base URL of the coordinate-tree API.
- `INFRA_CONFIG_API_TOKEN` — bearer token the proxy injects server-side; the
  browser only ever calls `/api/proxy/infra/...` and never sees it.

## Auth

`auth.providers.oidc` (Keycloak), `auth.session.secret`. See
**[Prepare for production](../how-to/prepare-for-production.md)** for the
must-externalise list.
