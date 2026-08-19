import type { ConfigApi } from '@backstage/core-plugin-api';

export interface GrafanaConfig {
  baseUrl: string;
  uid: string;
  slug: string;
  theme?: 'light' | 'dark';
  kiosk?: boolean;
}

/** Whether `platform.grafana` is present in config at all. */
export function isGrafanaConfigured(config: ConfigApi): boolean {
  return !!config.getOptionalConfig('platform.grafana');
}

/**
 * Whether a uid/slug is safe to concatenate into a dashboard URL's path.
 *
 * uid/slug land straight in the path, so '/' would inject extra path
 * segments, '?' would inject query parameters and '#' would inject a
 * fragment. None of the three can move the built URL off the configured
 * origin — sameOrigin's own origin check already holds regardless, since path
 * traversal normalizes away without ever changing the authority — this only
 * stops the URL itself from being hijacked into carrying something other than
 * a plain uid/slug. It is a fixed three-character blocklist, not a validator
 * against Grafana's actual uid/slug charset.
 */
export function isSafePathSegment(value: string): boolean {
  return !/[/?#]/.test(value);
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
