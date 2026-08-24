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

/**
 * A ref in the exact form the catalog stores it in `relations` —
 * `<kind>:<namespace>/<name>`, all lowercase.
 *
 * The catalog normalises every owner it is given: `parseEntityRef` fills in the
 * missing kind/namespace and `stringifyEntityRef` lowercases the result before
 * it lands in `relations.ownedBy` (and its search index lowercases again on the
 * way in and on the way out). So `payments`, `Group:default/Payments` and
 * `group:default/payments` are one group to the permission rule that decides
 * *visibility* — and anything comparing a raw `spec.owner` string against those
 * refs disagrees with it. That disagreement is the bug this exists to prevent:
 * a resource visible to a team but 403 on delete.
 *
 * Deliberately re-implemented rather than imported: this package carries no
 * dependencies on purpose (see `resourceOwnership.ts`), and `@backstage/catalog-model`
 * is a poor price for six lines. It mirrors `parseEntityRef` +
 * `stringifyEntityRef`, including their odd case where a `/` precedes the `:`
 * (then there is no kind), but never throws — an unparseable ref here means
 * "matches nothing", not a 500 in an authorization gate.
 *
 * ponytail: `defaultNamespace` is `default`, not `platform.catalog.namespace`.
 * A deployment that both moves the namespace *and* writes short-form owners
 * would normalise to the wrong namespace; thread the configured namespace
 * through both call sites together if that ever happens — apart is how they
 * drift.
 */
export function normalizeEntityRef(ref: string, defaultKind: string): string {
  let colonI = ref.indexOf(':');
  const slashI = ref.indexOf('/');
  if (slashI !== -1 && slashI < colonI) colonI = -1;
  const kind = colonI === -1 ? defaultKind : ref.slice(0, colonI);
  const namespace =
    slashI === -1 ? DEFAULT_NAMESPACE : ref.slice(colonI + 1, slashI);
  const name = ref.slice(Math.max(colonI + 1, slashI + 1));
  return `${kind}:${namespace}/${name}`.toLocaleLowerCase('en-US');
}
