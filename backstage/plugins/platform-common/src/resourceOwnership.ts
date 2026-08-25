import { normalizeEntityRef } from './refs';

/**
 * The shape these functions actually read.
 *
 * Structural rather than `Entity` from @backstage/catalog-model: this package
 * carries no dependencies on purpose, and a shared-types package taking one to
 * name two optional fields would be a poor trade. A real Entity satisfies this.
 */
type TemplateLike = {
  metadata: { name?: string; annotations?: Record<string, string> };
  spec?: { owner?: string };
};

/** resourceType -> the owning Template's `spec.owner` (the service-owner). */
export type ServiceOwnerMap = Map<string, string>;

/**
 * Which team approves changes to each resource type.
 *
 * This is the same lookup `ownerResolver` makes — a Template's
 * `platform.io/resource-type` annotation (first) or `metadata.name` (fallback)
 * naming the type it owns — lifted into a pure function because two callers now
 * need it: the permission policy that decides what a user may see, and the gate
 * that decides who may bulk-delete. Two copies of an authorization rule is how
 * they drift.
 *
 * A Template with no annotation falls back to its name, mirroring `ownerResolver`.
 * `bulk-delete-resources` carries no annotation and is named `bulk-delete-resources`
 * (not a resource type), so it cannot shadow real resource types even with the
 * name fallback.
 */
export function serviceOwnerMap(templates: TemplateLike[]): ServiceOwnerMap {
  const map: ServiceOwnerMap = new Map();
  for (const t of templates) {
    // Annotation takes precedence over name, matching ownerResolver's logic.
    const type =
      t.metadata.annotations?.['platform.io/resource-type'] ?? t.metadata.name;
    const owner = t.spec?.owner;
    // First wins. Two templates claiming one type is a misconfiguration; a
    // deterministic answer beats one that changes with catalog ordering.
    if (type && owner && !map.has(type)) map.set(type, owner);
  }
  return map;
}

/**
 * The resource types these groups service-own.
 *
 * Both sides are normalised the way the catalog normalises an owner before it
 * reaches `relations.ownedBy` — kind and namespace defaulted in, everything
 * lowercased (see {@link normalizeEntityRef}). A Template written with the
 * idiomatic short `owner: payments` is the same team as `group:default/payments`
 * to the permission rule that decides who may *see* its resources, so it has to
 * be the same team here, where it is decided who may delete them. Comparing raw
 * strings made a short-form Template silently service-own nothing: its owners
 * saw their resources listed and were refused on delete, with no error anywhere
 * to explain it.
 *
 * Groups are normalised with `defaultKind: 'Group'` — a bare `payments` in
 * either list means the group, matching what the catalog does to `spec.owner`.
 */
export function serviceOwnedTypes(
  map: ServiceOwnerMap,
  groups: string[],
): string[] {
  const owned = new Set(groups.map(g => normalizeEntityRef(g, 'Group')));
  return [...map.entries()]
    .filter(([, o]) => owned.has(normalizeEntityRef(o, 'Group')))
    .map(([t]) => t);
}
