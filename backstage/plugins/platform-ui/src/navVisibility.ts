/**
 * Which discovered nav items the sidebar offers.
 *
 * Kept apart from CustomNav so the rule is a pure function with a test, rather
 * than something you can only check by rendering the nav.
 */

/**
 * Routes that exist but are never offered in the sidebar, to anyone.
 *
 * `/catalog-graph` renders filters only until it is given a root entity, and
 * the page has no picker for one — Backstage expects you to arrive from an
 * entity. The relations card links to it with the root already set.
 */
export const HIDDEN_NAV_HREFS = ['/catalog-graph'];

/**
 * Routes offered to platform admins only (`platform.rbac.adminGroups`).
 *
 * All three are operator tooling rather than self-service: the API explorer,
 * catalog registration — which writes to the catalog, and here the workflows
 * own Git — and the app visualizer, which describes the frontend's own
 * extension tree. Hiding them is decluttering, not access control: the routes
 * still resolve if typed, and what may actually be *done* on them is decided
 * by the permission policy on the backend.
 */
export const ADMIN_NAV_HREFS = ['/api-docs', '/catalog-import', '/visualizer'];

/**
 * Routes offered only when the feature behind them is configured.
 *
 * `/dashboard` is an embedded Grafana and nothing else. With no
 * `platform.grafana`, the page redirects home — so offering the tab would be
 * offering a round trip to where you already were.
 */
export const GRAFANA_NAV_HREFS = ['/dashboard'];

/**
 * `isAdmin` is undefined while the identity is still loading, which counts as
 * not-an-admin — the admin links appearing a beat after the rest is a smaller
 * flaw than them showing to everyone and then vanishing. `grafanaConfigured`
 * defaults to false for the same reason.
 */
export function navItemVisible(
  href: string,
  isAdmin: boolean | undefined,
  grafanaConfigured: boolean = false,
): boolean {
  if (HIDDEN_NAV_HREFS.includes(href)) return false;
  if (GRAFANA_NAV_HREFS.includes(href) && !grafanaConfigured) return false;
  return isAdmin === true || !ADMIN_NAV_HREFS.includes(href);
}
