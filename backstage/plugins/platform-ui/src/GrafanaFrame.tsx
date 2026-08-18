import { configApiRef, useApi } from '@backstage/core-plugin-api';
import {
  dashboardUrl,
  isGrafanaConfigured,
  isSafePathSegment,
  sameOrigin,
} from './grafana';

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
  if (!isGrafanaConfigured(config)) return null;
  const cfg = config.getOptionalConfig('platform.grafana')!;

  const baseUrl = cfg.getString('baseUrl');
  const uid = cfg.getString('dashboard.uid');
  const slug = cfg.getString('dashboard.slug');

  const built = dashboardUrl(
    {
      baseUrl,
      uid,
      slug,
      theme: cfg.getOptionalString('theme') as 'light' | 'dark' | undefined,
      kiosk: cfg.getOptionalBoolean('kiosk'),
    },
    { from, to, panelId },
  );

  // sameOrigin alone cannot catch a hostile uid/slug: a value built from
  // cfg.baseUrl always parses back to cfg.baseUrl's origin no matter what they
  // contain (path traversal inside them normalizes away without ever changing
  // the origin). isSafePathSegment is what stops '/', '?' and '#' from
  // injecting extra path segments, query parameters or a fragment into the
  // built URL — see its doc comment for exactly what it does and does not
  // cover.
  if (
    !isSafePathSegment(uid) ||
    !isSafePathSegment(slug) ||
    !sameOrigin(baseUrl, built)
  ) {
    return (
      <a href={baseUrl} target="_blank" rel="noreferrer">
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
