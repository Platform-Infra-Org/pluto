/**
 * The shape these functions actually read.
 *
 * Structural rather than `Entity` from @backstage/catalog-model: this package
 * carries no dependencies on purpose, and a shared-types package taking one to
 * name two optional fields would be a poor trade. A real Entity satisfies this.
 */
type TemplateLike = {
  metadata?: { annotations?: Record<string, string> };
  spec?: { owner?: string };
};

/** resourceType -> the owning Template's `spec.owner` (the service-owner). */
export type ServiceOwnerMap = Map<string, string>;

/**
 * Which team approves changes to each resource type.
 *
 * This is the same lookup `ownerResolver` makes — a Template's
 * `platform.io/resource-type` annotation naming the type it owns — lifted into
 * a pure function because two callers now need it: the permission policy that
 * decides what a user may see, and the gate that decides who may bulk-delete.
 * Two copies of an authorization rule is how they drift.
 *
 * A Template with no annotation is skipped deliberately, not defensively:
 * `bulk-delete-resources` carries none precisely so it cannot shadow the real
 * owner of `git-resource`.
 */
export function serviceOwnerMap(templates: TemplateLike[]): ServiceOwnerMap {
  const map: ServiceOwnerMap = new Map();
  for (const t of templates) {
    const type = t.metadata?.annotations?.['platform.io/resource-type'];
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
 * Exact ref comparison, matching the permission policy and `isAdminRef` — the
 * checks must not disagree about which group a ref names.
 */
export function serviceOwnedTypes(
  map: ServiceOwnerMap,
  groups: string[],
): string[] {
  const owned = new Set(groups);
  return [...map.entries()].filter(([, o]) => owned.has(o)).map(([t]) => t);
}
