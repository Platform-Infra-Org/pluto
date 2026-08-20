import type { DashboardTarget } from './grafana';

/**
 * One resolved Grafana dashboard in an iframe.
 *
 * Deliberately knows nothing about config: `grafana.ts` reads it, builds the
 * URL and runs the origin/path guards, so all of that is testable without
 * React and both call sites get the same answer. What is left here is the
 * three-state render.
 *
 * No sandbox attribute: Grafana does not run sandboxed. The protection is the
 * origin check plus backend.csp.frame-src naming exactly one host.
 */
export function GrafanaFrame({
  target,
  title,
  height = 600,
}: {
  target?: DashboardTarget;
  title: string;
  height?: number;
}) {
  // Not configured: nothing here, not an empty box.
  if (!target) return null;

  // Configured, but the guards rejected the built URL. Staying silent would
  // make an operator error look exactly like an unconfigured deployment.
  if (!target.src) {
    return (
      <a href={target.baseUrl} target="_blank" rel="noreferrer">
        Open Grafana
      </a>
    );
  }

  return (
    <iframe
      title={title}
      src={target.src}
      width="100%"
      height={height}
      style={{ border: 0 }}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
