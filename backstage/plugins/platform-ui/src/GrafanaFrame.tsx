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

  // uid/slug are concatenated straight into the URL path, so a value built
  // from cfg.baseUrl always parses back to cfg.baseUrl's origin no matter what
  // they contain — path traversal inside them normalizes away without ever
  // changing the origin. The real guard against a hostile uid/slug (which may
  // one day come from a user-writable annotation) is refusing a '/' in either
  // one, before the origin check even runs.
  const injectsExtraSegments = uid.includes('/') || slug.includes('/');

  if (injectsExtraSegments || !sameOrigin(baseUrl, built)) {
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
