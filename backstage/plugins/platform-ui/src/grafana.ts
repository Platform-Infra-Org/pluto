import type { ConfigApi } from '@backstage/core-plugin-api';

/** A configured parameter: one value, or several for a multi-value variable. */
export type ParamValue = string | string[];

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
  params?: Record<string, ParamValue>;
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

/** A scalar YAML value as a query-parameter string, or undefined if it is not one. */
function scalar(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

/**
 * A `params` block as a flat map; `undefined` when it holds nothing.
 *
 * Read raw rather than through `getOptionalString`: that throws on a type
 * mismatch, so a plain `var-limit: 10` used to take the whole field down.
 * Numbers and booleans are ordinary Grafana variable values and coerce; a list
 * stays a list, because Grafana expresses a multi-value variable as the same
 * key repeated. Anything else is skipped — the frontend cannot refuse to start,
 * and a dashboard missing one variable beats a blank page.
 */
function readParams(node: ConfigNode | undefined): Record<string, ParamValue> | undefined {
  if (!node) return undefined;
  const out: Record<string, ParamValue> = {};
  for (const key of node.keys()) {
    const raw: unknown = node.get(key);
    if (Array.isArray(raw)) {
      const members = raw.map(scalar).filter((v): v is string => v !== undefined);
      if (members.length) out[key] = members;
      continue;
    }
    const one = scalar(raw);
    if (one !== undefined) out[key] = one;
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
    const base = new URL(baseUrl);
    // http/https only: a `javascript:` or `data:` URL parses to the opaque
    // origin `'null'`, so a baseUrl built the same way would equal it too and
    // pass the origin check below without this.
    if (base.protocol !== 'http:' && base.protocol !== 'https:') return false;
    return new URL(candidate).origin === base.origin;
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
    // `append` for a list so a multi-value variable survives as repeated keys.
    // The computed parameters below still use `set`, which collapses every
    // same-named value — so a computed one beats a configured list outright.
    if (Array.isArray(value)) for (const v of value) params.append(key, v);
    else params.set(key, value);
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
  params: Record<string, ParamValue> | undefined,
  ctx: GrafanaRequestContext,
): Record<string, ParamValue> | undefined {
  if (!params) return undefined;
  const values: Record<string, string> = {
    requestId: String(ctx.requestId ?? ''),
    resourceName: ctx.resourceName ?? '',
    resourceType: ctx.resourceType ?? '',
    requester: ctx.requester ?? '',
    workflowName: ctx.workflowName ?? '',
    workflowNamespace: ctx.workflowNamespace ?? '',
  };
  const one = (raw: string) =>
    raw.replace(TOKEN, (_m, token: string) =>
      Object.hasOwn(values, token) ? values[token] : '',
    );
  const out: Record<string, ParamValue> = {};
  for (const [key, raw] of Object.entries(params)) {
    if (Array.isArray(raw)) {
      const members = raw.map(one).filter(Boolean);
      if (members.length) out[key] = members;
      continue;
    }
    const value = one(raw);
    if (value) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

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
