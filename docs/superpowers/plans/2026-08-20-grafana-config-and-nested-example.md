# Grafana Configuration and Nested Cascade Example — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `platform.grafana` a real configuration surface — separate query
parameters for the global page and the request card, an off switch for the
request card, `<< >>` tokens scoped to the request — and make an unconfigured
deployment show no dashboard anywhere; plus move the shipped DynamicSelect
cascade example under a `metadata` object so it exercises the shape that broke.

**Architecture:** All Grafana config reading, URL building and safety
validation collapses into `plugins/platform-ui/src/grafana.ts` as pure
functions returning a three-state `DashboardTarget`. `GrafanaFrame` stops
reading config and becomes a dumb renderer of that target. Visibility of the
`/dashboard` nav entry moves into the existing pure `navItemVisible` predicate.

**Tech Stack:** TypeScript, React 18, Backstage new frontend system
(`@backstage/frontend-plugin-api`), `@backstage/config` `ConfigReader` for
tests, Jest + Testing Library, Helm.

**Spec:** `docs/superpowers/specs/2026-08-20-grafana-config-and-nested-example-design.md`

## Global Constraints

- All Node commands run from `backstage/`. Jest needs `CI=1` or
  `backstage-cli repo test` sits in interactive watch mode and prints nothing.
- Run one file with `CI=1 yarn test <path from backstage/>`.
- CI gate is `yarn tsc` → `yarn lint:all` → `CI=1 yarn test` → `yarn build:all`.
- `plugins/platform-requests-backend`'s three sqlite suites (56 tests) fail on
  this machine already — `better-sqlite3` is built for `NODE_MODULE_VERSION 127`
  and the running Node wants 141. Pre-existing on clean `main`; not caused by
  this work and not in scope to fix.
- Conventional commits. The PR title is what git-cliff parses. Never hand-edit
  `CHANGELOG.md` or version fields.
- State labels (`SUCCEEDED`, `FAILED`, …) are records and are never renamed.
- Every new `config.d.ts` key needs `@visibility frontend`. Config is served to
  every browser; nothing secret goes in `platform.grafana`.
- `plugins/platform-ui/src/styles.ts` is one template literal — do not touch it
  in this work.

---

### Task 1: Move the cascade example under `metadata`

**Files:**
- Modify: `deploy/dev/seed/software-templates/templates/coordinate-demo/template.yaml`
- Modify: `docs/how-to/add-a-dynamic-select-field.md:48-77`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks. Fixture + docs only.

`provision-database/template.yaml` deliberately stays flat, so the dev stack
seeds one template of each shape.

- [ ] **Step 1: Rewrite the coordinate-demo parameters block**

Replace the whole `parameters:` list in
`deploy/dev/seed/software-templates/templates/coordinate-demo/template.yaml`
with:

```yaml
  parameters:
    - title: Where should it live?
      required:
        - metadata
      properties:
        # Grouped under an object on purpose. `dependsOn` names a *sibling*
        # property, so nesting must change nothing about it — this template is
        # the fixture that keeps that true.
        metadata:
          type: object
          title: Coordinates
          required:
            - space
            - network
            - region
            - island
            - environment
          properties:
            # Same wiring a real deployment uses: proxyPath through the
            # Backstage proxy, so the upstream's credentials stay server-side.
            # Here it points at the platform backend's own demo options route;
            # in production it points at the config API
            # (/infra/coordinate-tree).
            space:
              type: string
              title: Space
              ui:field: DynamicSelect
              ui:options:
                { proxyPath: /demo-options/coordinate-tree, treePath: coordinates }
            network:
              type: string
              title: Network
              ui:field: DynamicSelect
              ui:options:
                {
                  proxyPath: /demo-options/coordinate-tree,
                  treePath: coordinates,
                  dependsOn: [space],
                }
            region:
              type: string
              title: Region
              ui:field: DynamicSelect
              ui:options:
                {
                  proxyPath: /demo-options/coordinate-tree,
                  treePath: coordinates,
                  dependsOn: [space, network],
                }
            island:
              type: string
              title: Island
              ui:field: DynamicSelect
              ui:options:
                {
                  proxyPath: /demo-options/coordinate-tree,
                  treePath: coordinates,
                  dependsOn: [space, network, region],
                }
            environment:
              type: string
              title: Environment
              ui:field: DynamicSelect
              ui:options:
                {
                  proxyPath: /demo-options/coordinate-tree,
                  treePath: coordinates,
                  dependsOn: [space, network, region, island],
                }
```

- [ ] **Step 2: Update the submit step's parameter references**

In the same file, the `steps:` block. Every `${{ parameters.<level> }}`
gains `metadata.`:

```yaml
  steps:
    - id: submit
      name: Submit request
      action: platform:request:submit
      input:
        resourceType: git-resource
        resourceName: ${{ parameters.metadata.space }}-${{ parameters.metadata.island }}-demo
        kind: CREATE
        params:
          space: ${{ parameters.metadata.space }}
          network: ${{ parameters.metadata.network }}
          region: ${{ parameters.metadata.region }}
          island: ${{ parameters.metadata.island }}
          environment: ${{ parameters.metadata.environment }}
        argoSubmit:
          namespace: argo
          workflowTemplate: param-echo
          entrypoint: echo-params
```

- [ ] **Step 3: Verify no bare parameter reference survives**

Run:

```bash
grep -n 'parameters\.' deploy/dev/seed/software-templates/templates/coordinate-demo/template.yaml
```

Expected: every hit reads `parameters.metadata.<level>`. No hit reads
`parameters.space`, `parameters.network`, `parameters.region`,
`parameters.island` or `parameters.environment`.

- [ ] **Step 4: Verify the YAML still parses**

Run:

```bash
python3 -c "import yaml,sys; d=yaml.safe_load(open('deploy/dev/seed/software-templates/templates/coordinate-demo/template.yaml')); print(sorted(d['spec']['parameters'][0]['properties']['metadata']['properties']))"
```

Expected: `['environment', 'island', 'network', 'region', 'space']`

- [ ] **Step 5: Update the how-to example**

In `docs/how-to/add-a-dynamic-select-field.md`, indent the five properties
under a `metadata:` object exactly as in Step 1, and add this sentence
immediately after the YAML block:

```markdown
The levels are grouped under `metadata` on purpose. `dependsOn` names a
*sibling* property and is resolved against whatever object the field sits in,
so grouping changes nothing about it — still `dependsOn: [space]`. What does
change is how the steps read the values: `${{ parameters.metadata.space }}`.
```

- [ ] **Step 6: Commit**

```bash
git add deploy/dev/seed/software-templates/templates/coordinate-demo/template.yaml \
        docs/how-to/add-a-dynamic-select-field.md
git commit -m "docs: group the cascade example under a metadata object"
```

---

### Task 2: `readGrafanaConfig` and a stricter `isGrafanaConfigured`

**Files:**
- Modify: `backstage/plugins/platform-ui/src/grafana.ts`
- Test: `backstage/plugins/platform-ui/src/grafana.test.ts`

**Interfaces:**
- Consumes: existing `GrafanaConfig`, `isSafePathSegment`, `sameOrigin`,
  `dashboardUrl` from `grafana.ts`.
- Produces:
  ```ts
  export interface GrafanaConfig {
    baseUrl: string;
    uid: string;
    slug: string;
    theme?: 'light' | 'dark';
    kiosk?: boolean;
    params?: Record<string, string>;   // new in this task
  }
  export interface PlatformGrafanaConfig {
    global: GrafanaConfig;
    /** Absent when `requests.enabled` is false. */
    requests?: GrafanaConfig;
  }
  export function readGrafanaConfig(config: ConfigApi): PlatformGrafanaConfig | undefined;
  export function isGrafanaConfigured(config: ConfigApi): boolean;
  ```

- [ ] **Step 1: Write the failing tests**

Replace the existing `describe('isGrafanaConfigured', …)` block at the bottom of
`grafana.test.ts` with:

```ts
describe('readGrafanaConfig', () => {
  const read = (data: Record<string, unknown>) =>
    readGrafanaConfig(new ConfigReader(data as never) as never);

  const FULL = {
    baseUrl: 'https://grafana.example.com',
    dashboard: { uid: 'abc123', slug: 'platform-overview' },
  };

  it('is undefined when platform.grafana is absent', () => {
    expect(read({})).toBeUndefined();
  });

  it('is undefined when the key exists but says nothing', () => {
    // The old check was `!!getOptionalConfig('platform.grafana')`, which was
    // true here — and then getString('dashboard.uid') threw and took the page
    // with it.
    expect(read({ platform: { grafana: {} } })).toBeUndefined();
  });

  it('is undefined without a dashboard uid or slug', () => {
    expect(read({ platform: { grafana: { baseUrl: 'https://g.example.com' } } })).toBeUndefined();
    expect(
      read({ platform: { grafana: { baseUrl: 'https://g.example.com', dashboard: { uid: 'a' } } } }),
    ).toBeUndefined();
  });

  it('reads the global dashboard', () => {
    expect(read({ platform: { grafana: { ...FULL, theme: 'dark', kiosk: true } } })?.global).toEqual({
      baseUrl: 'https://grafana.example.com',
      uid: 'abc123',
      slug: 'platform-overview',
      theme: 'dark',
      kiosk: true,
      params: undefined,
    });
  });

  it('reads the global params', () => {
    expect(
      read({ platform: { grafana: { ...FULL, params: { 'var-env': 'prod' } } } })?.global.params,
    ).toEqual({ 'var-env': 'prod' });
  });

  it('mirrors the global dashboard onto requests when requests is absent', () => {
    const cfg = read({ platform: { grafana: { ...FULL, theme: 'dark' } } });
    expect(cfg?.requests).toEqual({
      baseUrl: 'https://grafana.example.com',
      uid: 'abc123',
      slug: 'platform-overview',
      theme: 'dark',
      kiosk: undefined,
      params: undefined,
    });
  });

  it('lets requests override uid, slug, theme and kiosk', () => {
    const cfg = read({
      platform: {
        grafana: {
          ...FULL,
          theme: 'dark',
          kiosk: true,
          requests: { uid: 'def456', slug: 'req-detail', theme: 'light', kiosk: false },
        },
      },
    });
    expect(cfg?.requests).toEqual({
      baseUrl: 'https://grafana.example.com',
      uid: 'def456',
      slug: 'req-detail',
      theme: 'light',
      kiosk: false,
      params: undefined,
    });
  });

  it('does not inherit params onto requests', () => {
    // The point of the request block is that its variables differ. Inheriting
    // would make "only request-scoped variables" require unsetting the global
    // ones.
    const cfg = read({
      platform: {
        grafana: {
          ...FULL,
          params: { 'var-env': 'prod' },
          requests: { params: { 'var-request': '<< requestId >>' } },
        },
      },
    });
    expect(cfg?.global.params).toEqual({ 'var-env': 'prod' });
    expect(cfg?.requests?.params).toEqual({ 'var-request': '<< requestId >>' });
  });

  it('drops the request dashboard when it is disabled, keeping the global one', () => {
    const cfg = read({ platform: { grafana: { ...FULL, requests: { enabled: false } } } });
    expect(cfg?.requests).toBeUndefined();
    expect(cfg?.global.uid).toBe('abc123');
  });

  it('keeps the request dashboard when enabled is explicitly true', () => {
    const cfg = read({ platform: { grafana: { ...FULL, requests: { enabled: true } } } });
    expect(cfg?.requests?.uid).toBe('abc123');
  });
});

describe('isGrafanaConfigured', () => {
  it('is true for a complete config', () => {
    const config = new ConfigReader({
      platform: {
        grafana: {
          baseUrl: 'https://grafana.example.com',
          dashboard: { uid: 'abc123', slug: 'platform-overview' },
        },
      },
    });
    expect(isGrafanaConfigured(config as never)).toBe(true);
  });

  it('is false when platform.grafana is absent', () => {
    expect(isGrafanaConfigured(new ConfigReader({}) as never)).toBe(false);
  });

  it('is false for a baseUrl with no dashboard', () => {
    const config = new ConfigReader({
      platform: { grafana: { baseUrl: 'https://grafana.example.com' } },
    });
    expect(isGrafanaConfigured(config as never)).toBe(false);
  });
});
```

Add `readGrafanaConfig` to the import at the top of the file:

```ts
import {
  dashboardUrl,
  isGrafanaConfigured,
  isSafePathSegment,
  readGrafanaConfig,
  sameOrigin,
} from './grafana';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/grafana.test.ts`
Expected: FAIL — `readGrafanaConfig is not a function`.

- [ ] **Step 3: Implement**

In `grafana.ts`, add `params` to `GrafanaConfig`:

```ts
export interface GrafanaConfig {
  baseUrl: string;
  uid: string;
  slug: string;
  theme?: 'light' | 'dark';
  kiosk?: boolean;
  /**
   * Extra query parameters, written into the URL before the computed ones so a
   * computed value always wins. See `dashboardUrl`.
   */
  params?: Record<string, string>;
}
```

Then add, above `isGrafanaConfigured`. Note the `ConfigNode` alias: a
`params` block is a `Config` from `@backstage/config`, which this plugin has
only as a **devDependency** — importing it in `src/` would be an undeclared
runtime dependency. Deriving the type from `ConfigApi`, which is already
imported, costs one line and adds nothing to `package.json`:

```ts
/** The two dashboards this feature can show, fully resolved. */
export interface PlatformGrafanaConfig {
  global: GrafanaConfig;
  /** Absent when `platform.grafana.requests.enabled` is false. */
  requests?: GrafanaConfig;
}

/**
 * A config subtree, named without importing `@backstage/config` — that package
 * is a devDependency here, and `ConfigApi` is already in scope.
 */
type ConfigNode = NonNullable<ReturnType<ConfigApi['getOptionalConfig']>>;

/** A `params` block as a flat string map; `undefined` when it holds nothing. */
function readParams(node: ConfigNode | undefined): Record<string, string> | undefined {
  if (!node) return undefined;
  const out: Record<string, string> = {};
  for (const key of node.keys()) {
    const value = node.getOptionalString(key);
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * The whole `platform.grafana` block, or `undefined` when it cannot produce a
 * dashboard.
 *
 * "Cannot produce" is stricter than "is absent": a `platform.grafana` key
 * holding only a baseUrl used to pass the old presence check and then throw on
 * `getString('dashboard.uid')`. Everything downstream treats `undefined` as
 * "show nothing anywhere", which is also what an unconfigured deployment wants.
 *
 * `requests` inherits uid/slug/theme/kiosk from the global dashboard — the
 * common case is one dashboard viewed two ways — but never `params`, whose
 * whole purpose is to differ.
 */
export function readGrafanaConfig(
  config: ConfigApi,
): PlatformGrafanaConfig | undefined {
  const node = config.getOptionalConfig('platform.grafana');
  if (!node) return undefined;

  const baseUrl = node.getOptionalString('baseUrl');
  const uid = node.getOptionalString('dashboard.uid');
  const slug = node.getOptionalString('dashboard.slug');
  if (!baseUrl || !uid || !slug) return undefined;

  const theme = node.getOptionalString('theme') as 'light' | 'dark' | undefined;
  const kiosk = node.getOptionalBoolean('kiosk');
  const global: GrafanaConfig = {
    baseUrl,
    uid,
    slug,
    theme,
    kiosk,
    params: readParams(node.getOptionalConfig('params')),
  };

  const requests = node.getOptionalConfig('requests');
  if (requests?.getOptionalBoolean('enabled') === false) return { global };

  return {
    global,
    requests: {
      baseUrl,
      uid: requests?.getOptionalString('uid') ?? uid,
      slug: requests?.getOptionalString('slug') ?? slug,
      theme:
        (requests?.getOptionalString('theme') as 'light' | 'dark' | undefined) ??
        theme,
      kiosk: requests?.getOptionalBoolean('kiosk') ?? kiosk,
      params: readParams(requests?.getOptionalConfig('params')),
    },
  };
}
```

Replace the body of `isGrafanaConfigured` (keep its doc comment, updating the
first line):

```ts
/** Whether `platform.grafana` can actually produce a dashboard. */
export function isGrafanaConfigured(config: ConfigApi): boolean {
  return !!readGrafanaConfig(config);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/grafana.test.ts`
Expected: PASS, all describes green.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/grafana.ts \
        backstage/plugins/platform-ui/src/grafana.test.ts
git commit -m "feat: read the whole platform.grafana block in one place"
```

---

### Task 3: Config `params` in `dashboardUrl`

**Files:**
- Modify: `backstage/plugins/platform-ui/src/grafana.ts` (`dashboardUrl`)
- Test: `backstage/plugins/platform-ui/src/grafana.test.ts`

**Interfaces:**
- Consumes: `GrafanaConfig` with `params` from Task 2.
- Produces: `dashboardUrl(cfg, opts)` unchanged in signature; it now writes
  `cfg.params` first, then `panelId`, `kiosk`, `theme`, `from`, `to`.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('dashboardUrl', …)` block in `grafana.test.ts`:

```ts
  it('writes configured params into the query string', () => {
    expect(dashboardUrl({ ...CFG, params: { 'var-env': 'prod' } })).toBe(
      'https://grafana.example.com/d/abc123/platform-overview?var-env=prod',
    );
  });

  it('encodes param keys and values', () => {
    expect(
      dashboardUrl({ ...CFG, params: { 'var-team': 'a&b c' } }),
    ).toContain('var-team=a%26b+c');
  });

  it('lets a computed value beat a configured one of the same name', () => {
    // An operator pinning `from` must not defeat the request's own window —
    // scoping the card to that window is the card's whole reason to exist.
    const url = dashboardUrl(
      { ...CFG, params: { from: 'now-90d', 'var-env': 'prod' } },
      { from: '1750000000000', to: '1750003600000' },
    );
    expect(url).toContain('from=1750000000000');
    expect(url).not.toContain('now-90d');
    expect(url).toContain('var-env=prod');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/grafana.test.ts -t 'params'`
Expected: FAIL — the built URL has no query string.

- [ ] **Step 3: Implement**

In `dashboardUrl`, insert the config params before every computed one, and
extend the doc comment:

```ts
/**
 * `/d/<uid>/<slug>` for a whole dashboard, `/d-solo/...` for one panel.
 *
 * Configured `params` are written first and the computed ones second, so
 * `panelId`, `kiosk`, `theme`, `from` and `to` always win a name collision.
 * `URLSearchParams` handles the encoding, so a param value never needs
 * escaping by the caller.
 */
export function dashboardUrl(
  cfg: GrafanaConfig,
  opts: { panelId?: number; from?: string; to?: string } = {},
): string {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const path = opts.panelId === undefined ? 'd' : 'd-solo';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(cfg.params ?? {})) {
    params.set(key, value);
  }
  if (opts.panelId !== undefined) params.set('panelId', String(opts.panelId));
  if (cfg.kiosk) params.set('kiosk', '1');
  if (cfg.theme) params.set('theme', cfg.theme);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  const qs = params.toString();
  return `${base}/${path}/${cfg.uid}/${cfg.slug}${qs ? `?${qs}` : ''}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/grafana.test.ts`
Expected: PASS. The five original `dashboardUrl` tests must still pass — with
no `params`, the loop writes nothing and the URLs are byte-identical.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/grafana.ts \
        backstage/plugins/platform-ui/src/grafana.test.ts
git commit -m "feat: carry configured query params into the dashboard url"
```

---

### Task 4: `<< >>` token resolution for request params

**Files:**
- Modify: `backstage/plugins/platform-ui/src/grafana.ts`
- Test: `backstage/plugins/platform-ui/src/grafana.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export interface GrafanaRequestContext {
    requestId: number | string;
    resourceName?: string;
    resourceType?: string;
    requester?: string;
    workflowName?: string;
    workflowNamespace?: string;
  }
  export function resolveParams(
    params: Record<string, string> | undefined,
    ctx: GrafanaRequestContext,
  ): Record<string, string> | undefined;
  ```

- [ ] **Step 1: Write the failing tests**

Append a new top-level describe to `grafana.test.ts`:

```ts
describe('resolveParams', () => {
  const CTX = {
    requestId: 41,
    resourceName: 'checkout-db',
    resourceType: 'git-resource',
    requester: 'ada',
    workflowName: 'git-ops-abc12',
    workflowNamespace: 'argo',
  };

  it('is undefined for no params', () => {
    expect(resolveParams(undefined, CTX)).toBeUndefined();
  });

  it('passes a literal value through', () => {
    expect(resolveParams({ 'var-env': 'prod' }, CTX)).toEqual({ 'var-env': 'prod' });
  });

  it('resolves every token', () => {
    expect(
      resolveParams(
        {
          a: '<< requestId >>',
          b: '<< resourceName >>',
          c: '<< resourceType >>',
          d: '<< requester >>',
          e: '<< workflowName >>',
          f: '<< workflowNamespace >>',
        },
        CTX,
      ),
    ).toEqual({
      a: '41',
      b: 'checkout-db',
      c: 'git-resource',
      d: 'ada',
      e: 'git-ops-abc12',
      f: 'argo',
    });
  });

  it('tolerates missing whitespace inside the delimiters', () => {
    expect(resolveParams({ a: '<<requestId>>' }, CTX)).toEqual({ a: '41' });
  });

  it('substitutes inside a larger string', () => {
    expect(resolveParams({ a: 'req-<< requestId >>-x' }, CTX)).toEqual({ a: 'req-41-x' });
  });

  it('drops a param that resolves to nothing', () => {
    // An empty Grafana variable reads as "all", which silently widens a
    // dashboard meant to be scoped to one request. Absent is the safer answer.
    expect(resolveParams({ a: '<< workflowName >>' }, { requestId: 1 })).toBeUndefined();
  });

  it('drops an unknown token but keeps its siblings', () => {
    expect(resolveParams({ a: '<< nope >>', b: 'prod' }, CTX)).toEqual({ b: 'prod' });
  });
});
```

Add `resolveParams` to the import at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/grafana.test.ts -t resolveParams`
Expected: FAIL — `resolveParams is not a function`.

- [ ] **Step 3: Implement**

Add to `grafana.ts`:

```ts
/** What a request-scoped `<< token >>` may be resolved against. */
export interface GrafanaRequestContext {
  requestId: number | string;
  resourceName?: string;
  resourceType?: string;
  requester?: string;
  workflowName?: string;
  workflowNamespace?: string;
}

const TOKEN = /<<\s*([a-zA-Z]+)\s*>>/g;

/**
 * `<< token >>` substitution for `platform.grafana.requests.params`.
 *
 * The notation is the backend's, so there is one syntax in the product; the
 * vocabulary is not — this is a small, client-side set resolved against the
 * request on screen, not the backend's submit tokens (docs/reference/tokens.md
 * lists both and says which is which).
 *
 * A param that resolves to an empty string is dropped rather than sent empty:
 * an empty Grafana variable usually means "all", which would quietly widen a
 * dashboard that was meant to be scoped to one request.
 */
export function resolveParams(
  params: Record<string, string> | undefined,
  ctx: GrafanaRequestContext,
): Record<string, string> | undefined {
  if (!params) return undefined;
  const values: Record<string, string> = {
    requestId: String(ctx.requestId ?? ''),
    resourceName: ctx.resourceName ?? '',
    resourceType: ctx.resourceType ?? '',
    requester: ctx.requester ?? '',
    workflowName: ctx.workflowName ?? '',
    workflowNamespace: ctx.workflowNamespace ?? '',
  };
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(params)) {
    const value = raw.replace(TOKEN, (_match, token: string) => values[token] ?? '');
    if (value) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/grafana.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/grafana.ts \
        backstage/plugins/platform-ui/src/grafana.test.ts
git commit -m "feat: resolve << >> tokens in request dashboard params"
```

---

### Task 5: `DashboardTarget` and the two URL builders

**Files:**
- Modify: `backstage/plugins/platform-ui/src/grafana.ts`
- Test: `backstage/plugins/platform-ui/src/grafana.test.ts`

**Interfaces:**
- Consumes: `readGrafanaConfig`, `dashboardUrl`, `resolveParams`,
  `isSafePathSegment`, `sameOrigin`.
- Produces:
  ```ts
  export interface DashboardTarget {
    baseUrl: string;
    /** Absent when the uid/slug or the built URL failed the guards. */
    src?: string;
  }
  export function globalDashboardUrl(config: ConfigApi): DashboardTarget | undefined;
  export function requestDashboardUrl(
    config: ConfigApi,
    ctx: GrafanaRequestContext & { from?: string; to?: string },
  ): DashboardTarget | undefined;
  ```

- [ ] **Step 1: Write the failing tests**

Append to `grafana.test.ts`:

```ts
describe('globalDashboardUrl / requestDashboardUrl', () => {
  const cfg = (grafana: Record<string, unknown>) =>
    new ConfigReader({ platform: { grafana } } as never) as never;

  const FULL = {
    baseUrl: 'https://grafana.example.com',
    dashboard: { uid: 'abc123', slug: 'platform-overview' },
  };

  const CTX = { requestId: 41, workflowName: 'git-ops-abc12', workflowNamespace: 'argo' };

  it('is undefined for both when nothing is configured', () => {
    expect(globalDashboardUrl(cfg({}))).toBeUndefined();
    expect(requestDashboardUrl(cfg({}), CTX)).toBeUndefined();
  });

  it('builds the global dashboard with only its own params', () => {
    expect(
      globalDashboardUrl(
        cfg({ ...FULL, params: { 'var-env': 'prod' }, requests: { params: { 'var-x': 'y' } } }),
      ),
    ).toEqual({
      baseUrl: 'https://grafana.example.com',
      src: 'https://grafana.example.com/d/abc123/platform-overview?var-env=prod',
    });
  });

  it('builds the request dashboard with its own params, tokens resolved, plus the window', () => {
    expect(
      requestDashboardUrl(
        cfg({ ...FULL, requests: { uid: 'def456', slug: 'req-detail', params: { 'var-wf': '<< workflowName >>' } } }),
        { ...CTX, from: '1750000000000', to: '1750003600000' },
      ),
    ).toEqual({
      baseUrl: 'https://grafana.example.com',
      src:
        'https://grafana.example.com/d/def456/req-detail' +
        '?var-wf=git-ops-abc12&from=1750000000000&to=1750003600000',
    });
  });

  it('is undefined for the request dashboard when it is disabled, and fine for the global one', () => {
    const disabled = cfg({ ...FULL, requests: { enabled: false } });
    expect(requestDashboardUrl(disabled, CTX)).toBeUndefined();
    expect(globalDashboardUrl(disabled)?.src).toContain('/d/abc123/platform-overview');
  });

  it('yields a target with no src when the uid escapes the path', () => {
    // Configured-but-wrong must stay loud: the caller renders an "Open Grafana"
    // link rather than nothing, which is what "not configured" looks like.
    expect(
      globalDashboardUrl(cfg({ ...FULL, dashboard: { uid: '../../..//evil.example.com/x', slug: 'y' } })),
    ).toEqual({ baseUrl: 'https://grafana.example.com' });
  });

  it('yields a target with no src when the requests uid escapes the path', () => {
    expect(
      requestDashboardUrl(cfg({ ...FULL, requests: { uid: 'abc123?evil=1' } }), CTX),
    ).toEqual({ baseUrl: 'https://grafana.example.com' });
  });
});
```

Add `globalDashboardUrl` and `requestDashboardUrl` to the import at the top.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/grafana.test.ts -t DashboardUrl`
Expected: FAIL — `globalDashboardUrl is not a function`.

- [ ] **Step 3: Implement**

Add to `grafana.ts`:

```ts
/**
 * Where a frame should point, in three states.
 *
 * `undefined` from a builder means not configured — render nothing at all.
 * A target with no `src` means configured but rejected by the guards, which is
 * an operator error and must stay visible. A target with a `src` is good.
 */
export interface DashboardTarget {
  baseUrl: string;
  src?: string;
}

/**
 * Build and validate in one place: the guards need the uid and slug, and this
 * is the last point that holds them.
 *
 * `sameOrigin` alone cannot catch a hostile uid/slug — a URL built from
 * cfg.baseUrl parses back to cfg.baseUrl's origin whatever they contain, since
 * path traversal normalizes away without ever changing the authority.
 * `isSafePathSegment` is what stops '/', '?' and '#' from injecting extra path
 * segments, query parameters or a fragment.
 */
function toTarget(
  cfg: GrafanaConfig,
  opts: { from?: string; to?: string } = {},
): DashboardTarget {
  const src = dashboardUrl(cfg, opts);
  if (
    !isSafePathSegment(cfg.uid) ||
    !isSafePathSegment(cfg.slug) ||
    !sameOrigin(cfg.baseUrl, src)
  ) {
    return { baseUrl: cfg.baseUrl };
  }
  return { baseUrl: cfg.baseUrl, src };
}

/** The `/dashboard` page's frame, or `undefined` when Grafana is unconfigured. */
export function globalDashboardUrl(
  config: ConfigApi,
): DashboardTarget | undefined {
  const read = readGrafanaConfig(config);
  return read ? toTarget(read.global) : undefined;
}

/**
 * A request page's Metrics frame, or `undefined` when Grafana is unconfigured
 * or `platform.grafana.requests.enabled` is false.
 */
export function requestDashboardUrl(
  config: ConfigApi,
  ctx: GrafanaRequestContext & { from?: string; to?: string },
): DashboardTarget | undefined {
  const read = readGrafanaConfig(config);
  if (!read?.requests) return undefined;
  return toTarget(
    { ...read.requests, params: resolveParams(read.requests.params, ctx) },
    { from: ctx.from, to: ctx.to },
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/grafana.test.ts`
Expected: PASS, every describe in the file.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/grafana.ts \
        backstage/plugins/platform-ui/src/grafana.test.ts
git commit -m "feat: resolve grafana dashboard targets outside react"
```

---

### Task 6: `GrafanaFrame` takes a target

**Files:**
- Modify: `backstage/plugins/platform-ui/src/GrafanaFrame.tsx`
- Modify: `backstage/plugins/platform-ui/src/index.ts:51-52`
- Test: `backstage/plugins/platform-ui/src/GrafanaFrame.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `DashboardTarget` from Task 5.
- Produces:
  ```tsx
  export function GrafanaFrame(props: {
    target?: DashboardTarget;
    title: string;
    height?: number;   // default 600
  }): JSX.Element | null;
  ```
  `plugins/platform-ui/src/index.ts` additionally exports
  `globalDashboardUrl`, `requestDashboardUrl`, `isGrafanaConfigured` and the
  types `DashboardTarget` and `GrafanaRequestContext`.

Note this task deletes `GrafanaFrame`'s `from`, `to` and `panelId` props. No
call site passes `panelId`; `from`/`to` move to `requestDashboardUrl`.
`dashboardUrl`'s own `panelId` option stays — it is tested and documented, and
removing it is not part of this work.

- [ ] **Step 1: Rewrite the test file**

Replace `GrafanaFrame.test.tsx` entirely:

```tsx
// toHaveAttribute is a jest-dom matcher; this plugin has no global setup
// registering it (unlike plugin-platform-requests), so it's imported per-file,
// matching this repo's existing convention (see SuspendPanel.test.tsx).
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { GrafanaFrame } from './GrafanaFrame';

describe('GrafanaFrame', () => {
  it('renders nothing without a target', () => {
    // An unconfigured deployment degrades to absent, not to an empty box the
    // user cannot explain.
    const { container } = render(<GrafanaFrame title="Platform dashboard" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('frames the target src', () => {
    const { container } = render(
      <GrafanaFrame
        title="Platform dashboard"
        target={{
          baseUrl: 'https://grafana.example.com',
          src: 'https://grafana.example.com/d/abc123/platform-overview?kiosk=1',
        }}
      />,
    );
    const frame = container.querySelector('iframe');
    expect(frame!.getAttribute('src')).toBe(
      'https://grafana.example.com/d/abc123/platform-overview?kiosk=1',
    );
    expect(frame!.getAttribute('title')).toBe('Platform dashboard');
    // Grafana does not run sandboxed; the protection is the origin check plus
    // a frame-src naming exactly one host.
    expect(frame!.getAttribute('sandbox')).toBeNull();
    expect(frame!.getAttribute('referrerpolicy')).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('honours the height', () => {
    const { container } = render(
      <GrafanaFrame
        title="x"
        height={800}
        target={{ baseUrl: 'https://grafana.example.com', src: 'https://grafana.example.com/d/a/b' }}
      />,
    );
    expect(container.querySelector('iframe')!.getAttribute('height')).toBe('800');
  });

  it('offers a way out when the target was rejected', () => {
    // Configured-but-wrong is an operator error and must not look identical to
    // not-configured.
    const { container } = render(
      <GrafanaFrame title="x" target={{ baseUrl: 'https://grafana.example.com' }} />,
    );
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('link', { name: /open grafana/i })).toHaveAttribute(
      'href',
      'https://grafana.example.com',
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/GrafanaFrame.test.tsx`
Expected: FAIL — the component still requires the config API and ignores
`target`.

- [ ] **Step 3: Implement**

Replace `GrafanaFrame.tsx` entirely:

```tsx
import type { DashboardTarget } from './grafana';

/**
 * One resolved Grafana dashboard in an iframe.
 *
 * Deliberately knows nothing about config: `grafana.ts` reads it, builds the
 * URL and runs the origin/path guards, so all of that is testable without
 * React and both call sites get the same answer. What is left here is the
 * three-state render.
 *
 * No sandbox attribute: Grafana does not run sandboxed. The protection is the
 * origin check plus backend.csp.frame-src naming exactly one host.
 */
export function GrafanaFrame({
  target,
  title,
  height = 600,
}: {
  target?: DashboardTarget;
  title: string;
  height?: number;
}) {
  // Not configured: nothing here, not an empty box.
  if (!target) return null;

  // Configured, but the guards rejected the built URL. Staying silent would
  // make an operator error look exactly like an unconfigured deployment.
  if (!target.src) {
    return (
      <a href={target.baseUrl} target="_blank" rel="noreferrer">
        Open Grafana
      </a>
    );
  }

  return (
    <iframe
      title={title}
      src={target.src}
      width="100%"
      height={height}
      style={{ border: 0 }}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
```

Replace lines 51-52 of `plugins/platform-ui/src/index.ts` with:

```ts
export { GrafanaFrame } from './GrafanaFrame';
export {
  isGrafanaConfigured,
  globalDashboardUrl,
  requestDashboardUrl,
} from './grafana';
export type { DashboardTarget, GrafanaRequestContext } from './grafana';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/GrafanaFrame.test.tsx`
Expected: PASS.

`yarn tsc` will now fail in `plugin-platform-requests` — `DashboardPage` and
`RequestPage` still pass the old props. Tasks 7 and 9 fix them; do not chase it
here.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/GrafanaFrame.tsx \
        backstage/plugins/platform-ui/src/GrafanaFrame.test.tsx \
        backstage/plugins/platform-ui/src/index.ts
git commit -m "refactor: give GrafanaFrame a resolved target instead of config"
```

---

### Task 7: `/dashboard` disappears when unconfigured

**Files:**
- Modify: `backstage/plugins/platform-requests/src/components/DashboardPage.tsx`
- Test: `backstage/plugins/platform-requests/src/components/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `globalDashboardUrl`, `GrafanaFrame` from Task 6.
- Produces: nothing consumed later.

- [ ] **Step 1: Rewrite the test file**

Replace `DashboardPage.test.tsx` entirely:

```tsx
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConfigReader } from '@backstage/config';
import { configApiRef } from '@backstage/core-plugin-api';
import { TestApiProvider } from '@backstage/test-utils';
import { DashboardPage } from './DashboardPage';

function renderWith(config: Record<string, unknown>) {
  return render(
    <TestApiProvider apis={[[configApiRef, new ConfigReader(config as never)]] as never}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </TestApiProvider>,
  );
}

const CONFIGURED = {
  platform: {
    grafana: {
      baseUrl: 'https://grafana.example.com',
      dashboard: { uid: 'abc123', slug: 'platform-overview' },
    },
  },
};

describe('DashboardPage', () => {
  it('frames the configured dashboard', () => {
    const { container } = renderWith(CONFIGURED);
    expect(container.querySelector('iframe')).not.toBeNull();
  });

  it('sends you home when unconfigured', () => {
    // The nav entry is gone in this case (navVisibility), so this only covers
    // a typed or bookmarked URL. A blank page under a title is worse than
    // landing somewhere real.
    renderWith({});
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText(/platform metrics/i)).toBeNull();
  });

  it('sends you home when the key exists but says nothing', () => {
    renderWith({ platform: { grafana: {} } });
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests/src/components/DashboardPage.test.tsx`
Expected: FAIL — the page renders the "No dashboard configured" empty state
instead of redirecting.

- [ ] **Step 3: Implement**

Replace `DashboardPage.tsx` entirely:

```tsx
import { Navigate } from 'react-router-dom';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import {
  Page,
  PageHeader,
  GrafanaFrame,
  globalDashboardUrl,
} from '@internal/plugin-platform-ui';

export function DashboardPage() {
  const config = useApi(configApiRef);
  const target = globalDashboardUrl(config);

  // No Grafana, no page. The nav entry is hidden in this case too
  // (navVisibility.ts), so this only catches a typed or bookmarked URL —
  // sending it home beats a title over an empty body explaining itself.
  if (!target) return <Navigate to="/" replace />;

  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Platform metrics" />
      <GrafanaFrame target={target} title="Platform dashboard" height={800} />
    </Page>
  );
}
```

The `Card`, `EmptyState` and `SCROLL` imports go with the empty state.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests/src/components/DashboardPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-requests/src/components/DashboardPage.tsx \
        backstage/plugins/platform-requests/src/components/DashboardPage.test.tsx
git commit -m "feat: drop the dashboard page when grafana is unconfigured"
```

---

### Task 8: Hide the Dashboard nav entry when unconfigured

**Files:**
- Modify: `backstage/plugins/platform-ui/src/navVisibility.ts`
- Modify: `backstage/plugins/platform-ui/src/CustomNav.tsx:147`
- Test: `backstage/plugins/platform-ui/src/navVisibility.test.ts`

**Interfaces:**
- Consumes: `isGrafanaConfigured` from Task 2.
- Produces:
  ```ts
  export const GRAFANA_NAV_HREFS: string[];
  export function navItemVisible(
    href: string,
    isAdmin: boolean | undefined,
    grafanaConfigured?: boolean,   // defaults to false
  ): boolean;
  ```

- [ ] **Step 1: Write the failing tests**

Append to `navVisibility.test.ts`:

```ts
describe('grafana-backed routes', () => {
  it('offers /dashboard only when grafana is configured', () => {
    for (const isAdmin of [true, false, undefined]) {
      expect(navItemVisible('/dashboard', isAdmin, true)).toBe(true);
      expect(navItemVisible('/dashboard', isAdmin, false)).toBe(false);
    }
  });

  it('hides /dashboard when nobody says whether grafana is configured', () => {
    // Absent argument means "not configured". A tab that appears and then
    // vanishes is worse than one that appears a beat late.
    expect(navItemVisible('/dashboard', true)).toBe(false);
  });

  it('leaves ordinary routes alone regardless of grafana', () => {
    expect(navItemVisible('/catalog', false, false)).toBe(true);
    expect(navItemVisible('/create', false, false)).toBe(true);
  });
});
```

Add `GRAFANA_NAV_HREFS` to the existing import line if you reference it;
otherwise leave the import as-is.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/navVisibility.test.ts`
Expected: FAIL — `/dashboard` is currently visible in all cases.

- [ ] **Step 3: Implement**

In `navVisibility.ts`, add above `navItemVisible`:

```ts
/**
 * Routes offered only when the feature behind them is configured.
 *
 * `/dashboard` is an embedded Grafana and nothing else. With no
 * `platform.grafana`, the page redirects home — so offering the tab would be
 * offering a round trip to where you already were.
 */
export const GRAFANA_NAV_HREFS = ['/dashboard'];
```

and replace the function:

```ts
/**
 * `isAdmin` is undefined while the identity is still loading, which counts as
 * not-an-admin — the admin links appearing a beat after the rest is a smaller
 * flaw than them showing to everyone and then vanishing. `grafanaConfigured`
 * defaults to false for the same reason.
 */
export function navItemVisible(
  href: string,
  isAdmin: boolean | undefined,
  grafanaConfigured: boolean = false,
): boolean {
  if (HIDDEN_NAV_HREFS.includes(href)) return false;
  if (GRAFANA_NAV_HREFS.includes(href) && !grafanaConfigured) return false;
  return isAdmin === true || !ADMIN_NAV_HREFS.includes(href);
}
```

In `CustomNav.tsx`, import `isGrafanaConfigured` from `./grafana`, compute it
next to `isAdmin`, and pass it:

```tsx
  const isAdmin = useIsAdmin();
  const grafanaConfigured = isGrafanaConfigured(config);
```

```tsx
    if (!navItemVisible(item.href, isAdmin, grafanaConfigured)) return null;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-ui/src/navVisibility.test.ts`
Expected: PASS, including the three original tests.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-ui/src/navVisibility.ts \
        backstage/plugins/platform-ui/src/navVisibility.test.ts \
        backstage/plugins/platform-ui/src/CustomNav.tsx
git commit -m "feat: hide the dashboard nav entry without grafana config"
```

---

### Task 9: The request page's Metrics card

**Files:**
- Modify: `backstage/plugins/platform-requests/src/components/RequestPage.tsx:24-25,527-547`
- Test: `backstage/plugins/platform-requests/src/components/RequestPage.test.tsx`

**Interfaces:**
- Consumes: `requestDashboardUrl`, `GrafanaFrame` from Tasks 5 and 6.
- Produces: nothing consumed later.

- [ ] **Step 1: Give the existing helper a request override**

`RequestPage.test.tsx` already has a `renderWith(config)` helper over a fixed
`REQUEST` constant. That constant has **no `workflowName`**, so the file's first
test breaks the moment Task 9's gate lands — which is correct, and the fixture
is what has to change.

Widen the helper and give the fixture a workflow. In `RequestPage.test.tsx`,
replace the `REQUEST` constant and the `renderWith` signature:

```tsx
const REQUEST: Request = {
  id: 42,
  kind: 'CREATE',
  resourceType: 'demo-resource',
  resourceName: 'my-resource',
  params: {},
  state: 'SUCCEEDED',
  policy: { mode: 'SINGLE' },
  requester: 'dana',
  approvals: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T01:00:00.000Z',
  // The Metrics card is gated on the workflow having shown up, so the default
  // fixture is a request that ran. Tests that want the other side pass an
  // override.
  workflowName: 'git-ops-abc12',
  workflowNamespace: 'argo',
};

function renderWith(
  config: Record<string, unknown>,
  request: Partial<Request> = {},
) {
  const value = { ...REQUEST, ...request };
  return render(
    <MemoryRouter>
      <TestApiProvider
        apis={[
          [requestsApiRef, { get: jest.fn().mockResolvedValue(value) } as never],
          [
            identityApiRef,
            {
              getBackstageIdentity: jest.fn().mockResolvedValue({
                ownershipEntityRefs: [],
                userEntityRef: 'user:default/dana',
              }),
            } as never,
          ],
          [
            catalogApiRef,
            { getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }) } as never,
          ],
          [configApiRef, new ConfigReader(config as never)],
        ]}
      >
        <RequestPage />
      </TestApiProvider>
    </MemoryRouter>,
  );
}
```

Leave the two existing tests in `describe('RequestPage — Metrics card', …)`
exactly as they are — with the fixture now carrying a `workflowName`, both
still describe true behaviour, and the first still asserts the exact
`?from=1767225600000&to=1767229200000` src.

- [ ] **Step 2: Write the failing tests**

Append to the same describe block:

```tsx
  const GRAFANA = {
    platform: {
      grafana: {
        baseUrl: 'https://grafana.example.com',
        dashboard: { uid: 'abc123', slug: 'platform-overview' },
      },
    },
  };

  it('stays hidden while the state is live but no workflow exists yet', async () => {
    // Submitted, or approved and not yet submitted, but the 5s poll has not
    // seen a workflow: there is no run to plot.
    renderWith(GRAFANA, { state: 'IN_PROGRESS', workflowName: undefined });
    await waitFor(() => expect(screen.getByText('my-resource')).toBeInTheDocument());
    expect(screen.queryByText('Metrics')).toBeNull();
  });

  it('stays hidden before a workflow could exist', async () => {
    renderWith(GRAFANA, { state: 'PENDING_APPROVAL', workflowName: undefined });
    await waitFor(() => expect(screen.getByText('my-resource')).toBeInTheDocument());
    expect(screen.queryByText('Metrics')).toBeNull();
  });

  it('shows for a suspended workflow', async () => {
    // A suspended workflow is a live one, and the old state list dropped the
    // card exactly when someone was looking at a stuck run.
    renderWith(GRAFANA, { state: 'AWAITING_INPUT' });
    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
  });

  it('shows while running', async () => {
    renderWith(GRAFANA, { state: 'IN_PROGRESS' });
    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
  });

  it('shows after a failure', async () => {
    renderWith(GRAFANA, { state: 'FAILED' });
    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
  });

  it('resolves request tokens into the frame src', async () => {
    renderWith({
      platform: {
        grafana: {
          ...GRAFANA.platform.grafana,
          requests: {
            params: {
              'var-wf': '<< workflowName >>',
              'var-req': '<< requestId >>',
              'var-missing': '<< ownerGroup >>',
            },
          },
        },
      },
    });
    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
    const src = document.querySelector('iframe')!.getAttribute('src')!;
    expect(src).toContain('var-wf=git-ops-abc12');
    expect(src).toContain('var-req=42');
    // ownerGroup is a backend submit token, not one of the six resolved here.
    expect(src).not.toContain('var-missing');
  });

  it('stays hidden when the request dashboard is disabled', async () => {
    renderWith({
      platform: {
        grafana: { ...GRAFANA.platform.grafana, requests: { enabled: false } },
      },
    });
    await waitFor(() => expect(screen.getByText('my-resource')).toBeInTheDocument());
    expect(screen.queryByText('Metrics')).toBeNull();
  });
```

If `screen.getByText('my-resource')` does not match — the page may render the
resource name inside a larger node — use whatever the file's existing tests
already wait on for "the page has loaded"; the point of that line is only to
avoid asserting absence before the request resolves.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests/src/components/RequestPage.test.tsx`
Expected: FAIL — at minimum the `AWAITING_INPUT`, no-`workflowName`, token and
`enabled: false` cases. The file may also fail to compile until Step 4, which
counts as failing.

- [ ] **Step 4: Implement**

In `RequestPage.tsx`, change the import from `@internal/plugin-platform-ui`:
drop `isGrafanaConfigured`, add `requestDashboardUrl` (keep `GrafanaFrame`).

Replace the Metrics block (currently lines 527-547) with:

```tsx
        {/* Bound to this request's own timestamps rather than a bookmarked
            dashboard: the window is exactly what happened while the workflow
            ran. Three independent reasons not to render, all readable here:
            no workflow has shown up yet, the state says there is nothing to
            plot, or platform.grafana.requests is off / absent. */}
        {request.workflowName &&
          ['IN_PROGRESS', 'AWAITING_INPUT', 'SUCCEEDED', 'FAILED'].includes(
            request.state,
          ) &&
          (() => {
            const target = requestDashboardUrl(config, {
              requestId: request.id,
              resourceName: request.resourceName,
              resourceType: request.resourceType,
              requester: request.requester,
              workflowName: request.workflowName,
              workflowNamespace: request.workflowNamespace,
              from: String(new Date(request.createdAt).getTime()),
              to: String(new Date(request.updatedAt).getTime()),
            });
            if (!target) return null;
            return (
              <div style={{ gridColumn: '1 / -1' }}>
                <Card>
                  <CardHeader title="Metrics" />
                  <CardBody>
                    <GrafanaFrame
                      target={target}
                      title={`Metrics for request #${request.id}`}
                      height={420}
                    />
                  </CardBody>
                </Card>
              </div>
            );
          })()}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backstage && CI=1 yarn test plugins/platform-requests/src/components/RequestPage.test.tsx`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 6: Commit**

```bash
git add backstage/plugins/platform-requests/src/components/RequestPage.tsx \
        backstage/plugins/platform-requests/src/components/RequestPage.test.tsx
git commit -m "feat: gate the metrics card on the workflow showing up"
```

---

### Task 10: Config schema, sample config, Helm and docs

**Files:**
- Modify: `backstage/plugins/platform-ui/config.d.ts` (the `platform.grafana` block)
- Modify: `backstage/app-config.yaml:283-294`
- Modify: `deploy/prod/helm/platform/values.yaml:186-198`
- Modify: `docs/how-to/embed-a-grafana-dashboard.md`
- Modify: `docs/reference/tokens.md`

**Interfaces:**
- Consumes: the config contract from Tasks 2-5.
- Produces: nothing consumed later.

`deploy/prod/helm/platform/templates/configmap-app-config.yaml` needs **no**
change: it already renders `toYaml .Values.platform.grafana`, so new keys flow
through, and the CSP `frame-src` override still keys off
`.Values.platform.grafana.baseUrl`.

- [ ] **Step 1: Replace the `grafana` block in `config.d.ts`**

```ts
    /**
     * An existing Grafana dashboard, embedded. Frontend-visible, so it holds a
     * URL and nothing else — this feature makes no Grafana API call and needs
     * no token. baseUrl is also the origin allowlist: nothing outside it is
     * ever framed.
     *
     * Omit the whole key and there is no dashboard anywhere: no `/dashboard`
     * page, no nav entry, no card on a request. A key that omits `baseUrl`,
     * `dashboard.uid` or `dashboard.slug` counts as omitted.
     * @visibility frontend
     */
    grafana?: {
      /** @visibility frontend */
      baseUrl: string;
      /** @visibility frontend */
      dashboard: {
        /** @visibility frontend */
        uid: string;
        /** @visibility frontend */
        slug: string;
      };
      /** @visibility frontend */
      theme?: 'light' | 'dark';
      /** @visibility frontend */
      kiosk?: boolean;
      /**
       * Extra query parameters for the `/dashboard` page only — Grafana
       * template variables, most usefully. Written into the URL before the
       * computed parameters, so `kiosk`, `theme`, `from` and `to` win a name
       * collision.
       * @visibility frontend
       */
      params?: { [key: string]: string };
      /**
       * The Metrics card on a request page, which frames the same dashboard
       * scoped to that request's own time window.
       *
       * Omit the block for "on, same dashboard, no extra parameters". `uid`,
       * `slug`, `theme` and `kiosk` fall back to the values above; `params`
       * deliberately does not, since differing is its whole purpose.
       * @visibility frontend
       */
      requests?: {
        /**
         * Set false to drop the card. The `/dashboard` page is unaffected.
         * @default true
         * @visibility frontend
         */
        enabled?: boolean;
        /** @visibility frontend */
        uid?: string;
        /** @visibility frontend */
        slug?: string;
        /** @visibility frontend */
        theme?: 'light' | 'dark';
        /** @visibility frontend */
        kiosk?: boolean;
        /**
         * Extra query parameters for the card only. Values may contain
         * `<< requestId >>`, `<< resourceName >>`, `<< resourceType >>`,
         * `<< requester >>`, `<< workflowName >>` and
         * `<< workflowNamespace >>`, resolved in the browser against the
         * request on screen. A parameter that resolves to an empty string is
         * dropped rather than sent empty — an empty Grafana variable reads as
         * "all".
         * @visibility frontend
         */
        params?: { [key: string]: string };
      };
    };
```

- [ ] **Step 2: Verify the schema compiles**

Run: `cd backstage && yarn tsc`
Expected: no output. (Tasks 1-9 must be done first; this is the first point the
whole tree type-checks again.)

- [ ] **Step 3: Extend the commented sample in `backstage/app-config.yaml`**

Replace the commented `grafana:` block with:

```yaml
  # An existing Grafana dashboard, embedded on /dashboard and on request pages
  # (scoped to that request's own time window). See
  # docs/how-to/embed-a-grafana-dashboard.md for the allow_embedding
  # requirement and the authentication trade-offs. Unset in dev — with no
  # config there is no dashboard page, no nav entry and no card.
  # grafana:
  #   baseUrl: ${GRAFANA_BASE_URL}
  #   dashboard:
  #     uid: ${GRAFANA_DASHBOARD_UID}
  #     slug: ${GRAFANA_DASHBOARD_SLUG}
  #   theme: dark
  #   kiosk: true
  #   # /dashboard only
  #   params:
  #     var-env: production
  #   requests:
  #     # false drops the card from request pages; /dashboard is unaffected
  #     enabled: true
  #     # uid/slug/theme/kiosk fall back to the values above; params do not
  #     params:
  #       var-workflow: '<< workflowName >>'
  #       var-namespace: '<< workflowNamespace >>'
```

- [ ] **Step 4: Extend the commented sample in `deploy/prod/helm/platform/values.yaml`**

```yaml
  # Existing Grafana dashboard, embedded on /dashboard and on request pages
  # (scoped to that request's own time window). Empty by default — with no
  # config there is no dashboard page, no nav entry and no card, and no
  # frame-src is added to the CSP either. See
  # docs/how-to/embed-a-grafana-dashboard.md for the allow_embedding
  # requirement and the authentication trade-offs.
  grafana: {}
  #  baseUrl: https://grafana.example.com
  #  dashboard:
  #    uid: abc123
  #    slug: platform-overview
  #  theme: dark
  #  kiosk: true
  #  params:
  #    var-env: production
  #  requests:
  #    enabled: true
  #    uid: def456
  #    slug: request-detail
  #    params:
  #      var-workflow: '<< workflowName >>'
  #      var-namespace: '<< workflowNamespace >>'
```

- [ ] **Step 5: Verify the chart still renders with and without Grafana**

Run:

```bash
helm template deploy/prod/helm/platform | grep -c 'frame-src'
helm template deploy/prod/helm/platform \
  --set platform.grafana.baseUrl=https://grafana.example.com \
  --set platform.grafana.dashboard.uid=abc123 \
  --set platform.grafana.dashboard.slug=overview \
  --set platform.grafana.requests.enabled=false \
  | grep -A3 'frame-src'
```

Expected: `0` for the first (no Grafana, no CSP widening); the second prints a
`frame-src` line naming `https://grafana.example.com`, and the rendered
`platform.grafana` block carries `requests.enabled: false` through.

- [ ] **Step 6: Rewrite the config section of the how-to**

In `docs/how-to/embed-a-grafana-dashboard.md`, replace the "Configure it"
section with:

````markdown
## Configure it

```yaml
platform:
  grafana:
    baseUrl: ${GRAFANA_BASE_URL}
    dashboard:
      uid: ${GRAFANA_DASHBOARD_UID}
      slug: ${GRAFANA_DASHBOARD_SLUG}
    theme: dark
    kiosk: true
```

`baseUrl` is frontend-visible config — served to every user — and it doubles
as an origin allowlist: the frame can never point anywhere else.

**With no `platform.grafana`, there is no dashboard anywhere**: no `/dashboard`
page, no Dashboard entry in the sidebar, no Metrics card on a request. A block
that omits `baseUrl`, `dashboard.uid` or `dashboard.slug` counts as absent —
that is deliberate, a half-configured dashboard used to throw and take the page
with it.

In the Helm chart, the equivalent is `platform.grafana` in `values.yaml`
(empty by default — see the commented example there).

### Two dashboards, one block

The same config drives two places: the `/dashboard` page, and a Metrics card on
every request page, scoped to that request's own time window.

```yaml
platform:
  grafana:
    baseUrl: https://grafana.example.com
    dashboard: { uid: abc123, slug: platform-overview }
    params:                       # the /dashboard page only
      var-env: production
    requests:                     # the request card only
      enabled: true               # false drops the card; /dashboard unaffected
      uid: def456                 # optional, else dashboard.uid
      slug: request-detail        # optional, else dashboard.slug
      params:
        var-workflow: '<< workflowName >>'
```

`uid`, `slug`, `theme` and `kiosk` inherit from the top level. **`params` does
not** — the point of the request block is that its variables differ, and
inheriting would mean unsetting the global ones to get only request-scoped
ones.

Configured `params` are written into the URL before the computed ones, so
`kiosk`, `theme`, `from` and `to` win a name collision. Pinning `from` in
`requests.params` will not defeat the request's own time window.

### Request-scoped values

Values under `requests.params` may carry `<< token >>` placeholders, resolved
in the browser against the request on screen:

| Token | Resolves to |
|---|---|
| `<< requestId >>` | the request's numeric id |
| `<< resourceName >>` | the resource name |
| `<< resourceType >>` | the resource type |
| `<< requester >>` | the requesting user's short id |
| `<< workflowName >>` | the Argo workflow's name |
| `<< workflowNamespace >>` | the Argo workflow's namespace |

This is a **smaller, separate set** from the backend's submit tokens — see
[submit tokens](../reference/tokens.md). A parameter that resolves to an empty
string is dropped rather than sent empty, because an empty Grafana variable
usually means "all", which would quietly widen a dashboard meant to be scoped
to one request.

### When the card appears

Once the request carries a workflow name — the 5s poll sets it as soon as Argo
actually has the workflow — and its state is `IN_PROGRESS`, `AWAITING_INPUT`,
`SUCCEEDED` or `FAILED`. Before that there is no run to plot.
````

- [ ] **Step 7: Add the client-side token section to the reference**

Append to `docs/reference/tokens.md`:

```markdown
## A second, smaller set: Grafana request params

`platform.grafana.requests.params` values use the same `<< >>` notation, but
they are **not these tokens**. They are resolved in the browser, at render
time, against the request on screen — a different implementation at a
different moment — and the vocabulary is six entries:

`<< requestId >>`, `<< resourceName >>`, `<< resourceType >>`,
`<< requester >>`, `<< workflowName >>`, `<< workflowNamespace >>`.

The notation is shared so there is one syntax in the product. Nothing else is.
See [embed a Grafana dashboard](../how-to/embed-a-grafana-dashboard.md).
```

- [ ] **Step 8: Run the full gate**

Run:

```bash
cd backstage && yarn tsc && yarn lint:all && CI=1 yarn test
```

Expected: `tsc` silent, lint clean, tests green apart from the three
pre-existing `platform-requests-backend` sqlite suites noted in Global
Constraints.

- [ ] **Step 9: Commit**

```bash
git add backstage/plugins/platform-ui/config.d.ts \
        backstage/app-config.yaml \
        deploy/prod/helm/platform/values.yaml \
        docs/how-to/embed-a-grafana-dashboard.md \
        docs/reference/tokens.md
git commit -m "feat: configurable grafana params, request toggle and tokens"
```

---

## Manual verification

Not a task — do this once after Task 10, against a real Grafana with
`allow_embedding = true`.

1. `bash scripts/backstage-up.sh`, then `yarn start` from `backstage/`.
2. With no `platform.grafana`: the sidebar has no Dashboard entry, and
   `http://localhost:3000/dashboard` lands on Home.
3. Add `platform.grafana` with `baseUrl`/`dashboard` to
   `backstage/app-config.local.yaml`: the Dashboard entry appears and frames.
4. Submit the `coordinate-demo` template. Confirm the cascade auto-fills space
   and network and offers a real choice at region, and that the created
   request's params carry the five coordinate values.
5. On that request, the Metrics card appears only once the request shows a
   workflow name. Add `requests: { enabled: false }` and confirm the card goes
   while `/dashboard` stays.
6. `bash scripts/prod-image-up.sh` and repeat step 3 — this is the only place
   the `frame-src` CSP actually applies (`yarn start` runs no helmet).
