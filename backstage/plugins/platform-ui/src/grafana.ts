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
