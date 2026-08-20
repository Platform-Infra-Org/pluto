import type { ConfigApi } from '@backstage/core-plugin-api';

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

/** Whether `platform.grafana` can actually produce a dashboard. */
export function isGrafanaConfigured(config: ConfigApi): boolean {
  return !!readGrafanaConfig(config);
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
