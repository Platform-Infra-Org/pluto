import { ConfigReader } from '@backstage/config';
import {
  dashboardUrl,
  isGrafanaConfigured,
  isSafePathSegment,
  readGrafanaConfig,
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
