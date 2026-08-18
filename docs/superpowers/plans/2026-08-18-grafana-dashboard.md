# Grafana Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed a configured Grafana dashboard in two places — a page in the sidebar, and a panel on a request page scoped to that request's time window.

**Architecture:** A ~15-line iframe component of our own rather than `@backstage-community/plugin-grafana`, whose embed is the same iframe but arrives with an ApiRef, two API-backed cards we do not want, a shared Grafana token we would otherwise not run, and no page extension for the sidebar placement. Config lives under `platform.grafana` following the repo's existing `config.d.ts` pattern, and the configured `baseUrl` doubles as an origin allowlist so a dashboard reference can never point the frame somewhere else.

**Tech Stack:** React 18, Backstage new frontend system (`PageBlueprint`, `createFrontendModule`), `config.d.ts` schema with `@visibility frontend`, helmet CSP via `backend.csp`.

**Spec:** `docs/superpowers/specs/2026-08-18-grafana-dashboard-design.md`

## Global Constraints

- All Node commands run from `backstage/` (Yarn 4 via corepack, Node 22).
- No Grafana API token anywhere the browser can read it. This design makes no Grafana API call at all, so no token should exist in the frontend config.
- Frontend-visible config is served to every user: `@visibility frontend` keys must contain nothing secret.
- Never render an iframe whose origin is not the configured `platform.grafana.baseUrl`.
- `yarn start` serves the frontend through the webpack dev server, which applies **no helmet**. Any CSP work must be verified under `bash scripts/prod-image-up.sh`, never `yarn start`.

---

### Task 1: The dashboard URL builder and the frame component

**Files:**
- Create: `backstage/plugins/platform-ui/src/grafana.ts`
- Create: `backstage/plugins/platform-ui/src/GrafanaFrame.tsx`
- Test: `backstage/plugins/platform-ui/src/grafana.test.ts`
- Modify: `backstage/plugins/platform-ui/config.d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export interface GrafanaConfig { baseUrl: string; uid: string; slug: string; theme?: 'light' | 'dark'; kiosk?: boolean }`
  - `export function dashboardUrl(cfg: GrafanaConfig, opts?: { panelId?: number; from?: string; to?: string }): string`
  - `export function sameOrigin(baseUrl: string, candidate: string): boolean`
  - `export function GrafanaFrame(props: { title: string; from?: string; to?: string; panelId?: number; height?: number }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `backstage/plugins/platform-ui/src/grafana.test.ts`:

```ts
import { dashboardUrl, sameOrigin } from './grafana';

const CFG = {
  baseUrl: 'https://grafana.example.com',
  uid: 'abc123',
  slug: 'platform-overview',
};

describe('dashboardUrl', () => {
  it('builds a kiosk dashboard url', () => {
    expect(dashboardUrl({ ...CFG, kiosk: true })).toBe(
      'https://grafana.example.com/d/abc123/platform-overview?kiosk=1',
    );
  });

  it('uses the solo endpoint for a single panel', () => {
    expect(dashboardUrl(CFG, { panelId: 7 })).toBe(
      'https://grafana.example.com/d-solo/abc123/platform-overview?panelId=7',
    );
  });

  it('carries a time window', () => {
    expect(dashboardUrl(CFG, { from: '1750000000000', to: '1750003600000' })).toBe(
      'https://grafana.example.com/d/abc123/platform-overview?from=1750000000000&to=1750003600000',
    );
  });

  it('passes the theme through', () => {
    expect(dashboardUrl({ ...CFG, theme: 'dark' })).toContain('theme=dark');
  });

  it('tolerates a trailing slash on baseUrl', () => {
    expect(dashboardUrl({ ...CFG, baseUrl: 'https://grafana.example.com/' })).toBe(
      'https://grafana.example.com/d/abc123/platform-overview',
    );
  });
});

describe('sameOrigin', () => {
  it('accepts the configured origin', () => {
    expect(sameOrigin('https://grafana.example.com', 'https://grafana.example.com/d/x/y')).toBe(true);
  });

  it('rejects another host', () => {
    expect(sameOrigin('https://grafana.example.com', 'https://evil.example.com/d/x/y')).toBe(false);
  });

  it('rejects a host that merely starts the same, which a string compare would pass', () => {
    expect(sameOrigin('https://grafana.example.com', 'https://grafana.example.com.evil.net/d')).toBe(false);
  });

  it('rejects a non-url', () => {
    expect(sameOrigin('https://grafana.example.com', 'javascript:alert(1)')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backstage && yarn test plugins/platform-ui/src/grafana.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the builder**

Create `backstage/plugins/platform-ui/src/grafana.ts`:

```ts
export interface GrafanaConfig {
  baseUrl: string;
  uid: string;
  slug: string;
  theme?: 'light' | 'dark';
  kiosk?: boolean;
}

/**
 * Whether a URL points at the configured Grafana and nowhere else.
 *
 * Parsed rather than compared as a string: `https://grafana.example.com.evil.net`
 * starts with the configured origin and would pass a prefix check. This is the
 * guard that makes it safe to ever take a dashboard reference from an
 * annotation, which is user-writable content.
 */
export function sameOrigin(baseUrl: string, candidate: string): boolean {
  try {
    return new URL(candidate).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

/** `/d/<uid>/<slug>` for a whole dashboard, `/d-solo/...` for one panel. */
export function dashboardUrl(
  cfg: GrafanaConfig,
  opts: { panelId?: number; from?: string; to?: string } = {},
): string {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const path = opts.panelId === undefined ? 'd' : 'd-solo';
  const params = new URLSearchParams();
  if (opts.panelId !== undefined) params.set('panelId', String(opts.panelId));
  if (cfg.kiosk) params.set('kiosk', '1');
  if (cfg.theme) params.set('theme', cfg.theme);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  const qs = params.toString();
  return `${base}/${path}/${cfg.uid}/${cfg.slug}${qs ? `?${qs}` : ''}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backstage && yarn test plugins/platform-ui/src/grafana.test.ts`
Expected: PASS, 9 assertions.

- [ ] **Step 5: Declare the config**

In `backstage/plugins/platform-ui/config.d.ts`, add alongside `app.branding`:

```ts
  platform?: {
    /**
     * An existing Grafana dashboard, embedded. Frontend-visible, so it holds a
     * URL and nothing else — this feature makes no Grafana API call and needs
     * no token. baseUrl is also the origin allowlist: nothing outside it is
     * ever framed.
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
    };
  };
```

- [ ] **Step 6: Write the component test**

Create `backstage/plugins/platform-ui/src/GrafanaFrame.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ConfigReader } from '@backstage/config';
import { configApiRef } from '@backstage/core-plugin-api';
import { TestApiProvider } from '@backstage/test-utils';
import { GrafanaFrame } from './GrafanaFrame';

function renderWith(config: Record<string, unknown>) {
  return render(
    <TestApiProvider apis={[[configApiRef, new ConfigReader(config)]] as never}>
      <GrafanaFrame title="Platform dashboard" />
    </TestApiProvider>,
  );
}

const GOOD = {
  platform: {
    grafana: {
      baseUrl: 'https://grafana.example.com',
      dashboard: { uid: 'abc123', slug: 'platform-overview' },
      kiosk: true,
    },
  },
};

describe('GrafanaFrame', () => {
  it('frames the configured dashboard', () => {
    const { container } = renderWith(GOOD);
    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame!.getAttribute('src')).toBe(
      'https://grafana.example.com/d/abc123/platform-overview?kiosk=1',
    );
    // Grafana does not run sandboxed; the protection is the origin check plus
    // a frame-src naming exactly one host.
    expect(frame!.getAttribute('sandbox')).toBeNull();
    expect(frame!.getAttribute('referrerpolicy')).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('renders nothing when grafana is not configured', () => {
    // An unconfigured deployment degrades to absent, not to an empty box the
    // user cannot explain.
    const { container } = renderWith({});
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('refuses to frame a host outside the configured origin', () => {
    const { container } = renderWith({
      platform: {
        grafana: {
          baseUrl: 'https://grafana.example.com',
          // A dashboard reference could one day come from an annotation, which
          // is user-writable. If the built URL leaves the configured origin,
          // the frame must not render.
          dashboard: { uid: '../../..//evil.example.com/x', slug: 'y' },
        },
      },
    });
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('link', { name: /open grafana/i })).toHaveAttribute(
      'href',
      'https://grafana.example.com',
    );
  });
});
```

Run: `cd backstage && yarn test plugins/platform-ui/src/GrafanaFrame.test.tsx`
Expected: FAIL — `GrafanaFrame` does not exist yet.

- [ ] **Step 7: Implement the component**

Create `backstage/plugins/platform-ui/src/GrafanaFrame.tsx`:

```tsx
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { dashboardUrl, sameOrigin } from './grafana';

/**
 * One configured Grafana dashboard in an iframe.
 *
 * No sandbox attribute: Grafana does not run sandboxed. The protection is the
 * origin check plus backend.csp.frame-src naming exactly one host.
 */
export function GrafanaFrame({
  title,
  from,
  to,
  panelId,
  height = 600,
}: {
  title: string;
  from?: string;
  to?: string;
  panelId?: number;
  height?: number;
}) {
  const config = useApi(configApiRef);
  const cfg = config.getOptionalConfig('platform.grafana');
  if (!cfg) return null;

  const built = dashboardUrl(
    {
      baseUrl: cfg.getString('baseUrl'),
      uid: cfg.getString('dashboard.uid'),
      slug: cfg.getString('dashboard.slug'),
      theme: cfg.getOptionalString('theme') as 'light' | 'dark' | undefined,
      kiosk: cfg.getOptionalBoolean('kiosk'),
    },
    { from, to, panelId },
  );

  if (!sameOrigin(cfg.getString('baseUrl'), built)) {
    return (
      <a href={cfg.getString('baseUrl')} target="_blank" rel="noreferrer">
        Open Grafana
      </a>
    );
  }

  return (
    <iframe
      title={title}
      src={built}
      width="100%"
      height={height}
      style={{ border: 0 }}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
```

- [ ] **Step 8: Run tests, type-check, lint, commit**

```bash
cd backstage && yarn test plugins/platform-ui/src/grafana.test.ts plugins/platform-ui/src/GrafanaFrame.test.tsx && yarn tsc && yarn lint:all
git add backstage/plugins/platform-ui/src/grafana.ts backstage/plugins/platform-ui/src/GrafanaFrame.tsx backstage/plugins/platform-ui/src/grafana.test.ts backstage/plugins/platform-ui/src/GrafanaFrame.test.tsx backstage/plugins/platform-ui/config.d.ts
git commit -m "feat: configurable Grafana dashboard frame"
```

---

### Task 2: Mount it — sidebar page and request page

**Files:**
- Modify: `backstage/plugins/platform-ui/src/index.ts`
- Modify: `backstage/plugins/platform-requests/src/plugin.tsx`
- Modify: `backstage/plugins/platform-requests/src/components/RequestPage.tsx`
- Modify: `backstage/plugins/platform-ui/src/CustomNav.tsx`
- Modify: `backstage/app-config.yaml`

**Interfaces:**
- Consumes: `GrafanaFrame` from Task 1.
- Produces: a route at `/dashboard`, a nav entry titled `Dashboard`, and a dashboard section on the request page.

- [ ] **Step 1: Export the component**

Add `export { GrafanaFrame } from './GrafanaFrame';` to `backstage/plugins/platform-ui/src/index.ts`.

- [ ] **Step 2: Add the page**

In `backstage/plugins/platform-requests/src/plugin.tsx`, next to the existing `PageBlueprint.make` calls, register a page at `path: '/dashboard'` whose loader renders a `Page`/`Content` wrapper (match the shape `HomePage.tsx` uses) containing `<GrafanaFrame title="Platform dashboard" height={800} />`. Add it to the plugin's `extensions` array.

- [ ] **Step 3: Add the nav entry**

In `backstage/plugins/platform-ui/src/CustomNav.tsx`, add a `Dashboard` item pointing at `/dashboard`, following the existing item shape. Route it through `screenName(item.title, flavour)` like its neighbours so the fantasy flavour can reskin it — the label is decoration, not a record.

- [ ] **Step 4: Add the request-page section**

In `backstage/plugins/platform-requests/src/components/RequestPage.tsx`, render the frame only for states where a dashboard means something:

```tsx
{['IN_PROGRESS', 'SUCCEEDED', 'FAILED'].includes(request.state) && (
  <GrafanaFrame
    title={`Metrics for request #${request.id}`}
    from={String(new Date(request.createdAt).getTime())}
    to={String(new Date(request.updatedAt).getTime())}
    height={420}
  />
)}
```

The time window is the whole point of this placement: bound to the request's own timestamps, the panel shows what happened while the workflow ran, which a bookmark cannot do. Confirm the actual field names on the request object before writing this — use whatever `RequestPage.tsx` already reads for its timestamps.

- [ ] **Step 5: Configure it**

In `backstage/app-config.yaml`:

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

- [ ] **Step 6: Open the CSP**

Also in `backstage/app-config.yaml`, extend the existing `backend.csp` block (which today overrides only `connect-src`):

```yaml
    frame-src: ["'self'", '${GRAFANA_BASE_URL}']
```

Mirror both blocks into `deploy/prod/helm/platform/values.yaml` where the other config lives.

- [ ] **Step 7: Verify under the production image, not the dev server**

Run: `bash scripts/prod-image-up.sh` and open `http://localhost:7007/dashboard`.

`yarn start` applies no helmet, so the iframe will appear to work there whatever the CSP says. Under the prod image, confirm: the dashboard renders; the browser console shows no CSP violation; and a request page in `SUCCEEDED` shows the panel with the request's time window. Then confirm Grafana itself is configured with `allow_embedding = true` — without it Grafana sends `X-Frame-Options: deny` and the frame stays blank no matter what Backstage does.

- [ ] **Step 8: Document it**

Add a `docs/how-to/embed-a-grafana-dashboard.md` covering the config block, the CSP entry, the `allow_embedding` requirement, and the three authentication options with their trade-offs stated plainly: anonymous Viewer (anyone who reaches Grafana can read it), an auth proxy, or Grafana 11.5+ Shared Dashboards (an unauthenticated URL per dashboard — genuinely public if Grafana is internet-reachable). Note the cookie cost: cross-site cookies need `cookie_samesite = none`, which weakens CSRF posture across all of Grafana. Add the page to `mkdocs.yml` nav and reference it from `docs/how-to/prepare-for-production.md`.

- [ ] **Step 9: Commit**

```bash
cd backstage && yarn tsc && yarn lint:all && yarn test
git add backstage/plugins/platform-ui/src/index.ts backstage/plugins/platform-ui/src/CustomNav.tsx backstage/plugins/platform-requests/src/plugin.tsx backstage/plugins/platform-requests/src/components/RequestPage.tsx backstage/app-config.yaml deploy/prod/helm/platform/values.yaml docs/how-to/embed-a-grafana-dashboard.md mkdocs.yml docs/how-to/prepare-for-production.md
git commit -m "feat: Grafana dashboard on the sidebar and request pages"
```
