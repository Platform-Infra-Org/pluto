import { ConfigReader } from '@backstage/config';
import {
  dashboardUrl,
  globalDashboardUrl,
  isGrafanaConfigured,
  isSafePathSegment,
  readGrafanaConfig,
  requestDashboardUrl,
  resolveParams,
  sameOrigin,
} from './grafana';

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
    // Test data only, never executed — the string itself is what's under test.
    // eslint-disable-next-line no-script-url
    expect(sameOrigin('https://grafana.example.com', 'javascript:alert(1)')).toBe(false);
  });

  it('rejects a javascript: baseUrl', () => {
    // `new URL('javascript:...').origin` is the opaque string 'null', which a
    // candidate built the same way would also produce — same-string equality
    // without a protocol check would wrongly call that "same origin".
    // eslint-disable-next-line no-script-url
    expect(sameOrigin('javascript:alert(1)', 'javascript:alert(2)')).toBe(false);
  });

  it('rejects a data: baseUrl', () => {
    expect(sameOrigin('data:text/html,<script>1</script>', 'data:text/html,<script>2</script>')).toBe(
      false,
    );
  });
});

describe('isSafePathSegment', () => {
  it('accepts a plain uid/slug', () => {
    expect(isSafePathSegment('abc123')).toBe(true);
    expect(isSafePathSegment('platform-overview')).toBe(true);
  });

  it('rejects a slash', () => {
    expect(isSafePathSegment('../../..//evil.example.com/x')).toBe(false);
  });

  it('rejects a query-string injection', () => {
    expect(isSafePathSegment('abc123?evil=1')).toBe(false);
  });

  it('rejects a fragment injection', () => {
    expect(isSafePathSegment('abc123#evil')).toBe(false);
  });
});

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

  it('drops an inherited Object.prototype token exactly like an unknown one', () => {
    // A plain-object lookup (`values[token]`) resolves `toString`,
    // `constructor`, `valueOf` and `hasOwnProperty` to inherited functions
    // instead of falling through to "unknown" — this would stringify a
    // function into the query.
    expect(resolveParams({ a: '<< toString >>', b: 'prod' }, CTX)).toEqual({ b: 'prod' });
    expect(resolveParams({ a: '<< constructor >>' }, CTX)).toBeUndefined();
    expect(resolveParams({ a: '<< hasOwnProperty >>' }, CTX)).toBeUndefined();
  });
});

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

describe('non-string param values', () => {
  const read = (params: unknown) =>
    readGrafanaConfig(
      new ConfigReader({
        platform: {
          grafana: {
            baseUrl: 'https://grafana.example.com',
            dashboard: { uid: 'abc123', slug: 'platform-overview' },
            params,
          },
        },
      } as never) as never,
    )?.global.params;

  it('coerces a number', () => {
    expect(read({ 'var-limit': 10 })).toEqual({ 'var-limit': '10' });
  });

  it('coerces a boolean', () => {
    expect(read({ kiosk: true })).toEqual({ kiosk: 'true' });
  });

  it('keeps a list as a list', () => {
    expect(read({ 'var-env': ['prod', 'staging'] })).toEqual({
      'var-env': ['prod', 'staging'],
    });
  });

  it('coerces the members of a list', () => {
    expect(read({ 'var-n': [1, 2] })).toEqual({ 'var-n': ['1', '2'] });
  });

  it('skips a value that is not a scalar or a list of them', () => {
    // The frontend cannot refuse to start; a dashboard missing one variable
    // beats a blank page.
    expect(read({ ok: 'yes', bad: { nested: 1 } })).toEqual({ ok: 'yes' });
  });
});

describe('dashboardUrl with list params', () => {
  it('repeats a list as multiple query parameters', () => {
    // How Grafana expresses a multi-value template variable.
    expect(dashboardUrl({ ...CFG, params: { 'var-env': ['prod', 'staging'] } })).toBe(
      'https://grafana.example.com/d/abc123/platform-overview?var-env=prod&var-env=staging',
    );
  });

  it('keeps a configured list intact beside a computed parameter', () => {
    // getAll, not toContain: the old implementation stringified the array to a
    // single "prod,staging" entry, which a substring assertion cannot tell
    // apart from two real ones.
    const url = dashboardUrl(
      { ...CFG, params: { 'var-env': ['prod', 'staging'] } },
      { from: '1750000000000' },
    );
    const qs = new URLSearchParams(url.split('?')[1]);
    expect(qs.getAll('var-env')).toEqual(['prod', 'staging']);
    expect(qs.getAll('from')).toEqual(['1750000000000']);
  });
});

describe('resolveParams with list values', () => {
  const CTX = { requestId: 41, workflowName: 'git-ops-abc12' };

  it('resolves each member', () => {
    expect(resolveParams({ a: ['<< requestId >>', 'lit'] }, CTX)).toEqual({
      a: ['41', 'lit'],
    });
  });

  it('drops the members that resolve empty', () => {
    expect(resolveParams({ a: ['<< requestId >>', '<< nope >>'] }, CTX)).toEqual({
      a: ['41'],
    });
  });

  it('drops a key whose whole list resolves empty', () => {
    expect(resolveParams({ a: ['<< nope >>'], b: 'keep' }, CTX)).toEqual({ b: 'keep' });
  });
});
