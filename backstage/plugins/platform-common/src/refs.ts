/**
 * Catalog entityRef and route formats, defined once.
 *
 * These four lines used to be six string literals spread across four packages,
 * every one of them hardcoding the `default` namespace. That was fine while the
 * namespace could not change; it can now (`platform.catalog.namespace`), and a
 * format duplicated six times is a format that drifts on the seventh edit.
 *
 * The namespace is always an **argument**, never read from config in here: this
 * module is imported by the browser and the backend alike, and the two read
 * config through completely different APIs. Callers resolve it — the frontend
 * via `useCatalogNamespace()`, the backend once at plugin start — and pass it
 * down. That is also what keeps these pure and trivially testable.
 *
 * @packageDocumentation
 */

/**
 * The namespace Backstage ingests into unless a deployment says otherwise, and
 * the fallback every caller applies when `platform.catalog.namespace` is unset.
 */
export const DEFAULT_NAMESPACE = 'default';

/** entityRef of a catalog Resource: `resource:<namespace>/<name>`. */
export function resourceRef(namespace: string, name: string): string {
  return `resource:${namespace}/${name}`;
}

/**
 * entityRef of a catalog User: `user:<namespace>/<id>`.
 *
 * `id` is the short id a request stores in `requester` — the namespace was
 * narrowed away when the request was created, so it has to be supplied again
 * here rather than recovered.
 */
export function userRef(namespace: string, id: string): string {
  return `user:${namespace}/${id}`;
}

/**
 * Route to an entity's catalog page: `/catalog/<namespace>/<kind>/<name>`.
 *
 * Name-based by definition — catalog routes address the entity's `name`, and a
 * title is neither unique nor routable, so only link *text* may use a title.
 */
export function catalogPath(
  namespace: string,
  kind: string,
  name: string,
): string {
  return `/catalog/${namespace}/${kind}/${name}`;
}
