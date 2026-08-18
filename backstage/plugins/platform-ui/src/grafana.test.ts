import { ConfigReader } from '@backstage/config';
import {
  dashboardUrl,
  isGrafanaConfigured,
  isSafePathSegment,
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

describe('isGrafanaConfigured', () => {
  it('is true when platform.grafana is present', () => {
    const config = new ConfigReader({
      platform: { grafana: { baseUrl: 'https://grafana.example.com' } },
    });
    expect(isGrafanaConfigured(config as never)).toBe(true);
  });

  it('is false when platform.grafana is absent', () => {
    const config = new ConfigReader({});
    expect(isGrafanaConfigured(config as never)).toBe(false);
  });
});
