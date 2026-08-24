import { AuthService, LoggerService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { MayDeleteVerdict } from './router';
import {
  ServiceOwnerMap,
  normalizeEntityRef,
  resourceRef,
  serviceOwnedTypes,
} from '@internal/plugin-platform-common';

/**
 * Who owns this entity, in the same form and from the same field the catalog's
 * `isEntityOwner` rule reads when it decides who may *see* it: the normalised
 * `relations.ownedBy` targetRefs the catalog derived from `spec.owner`.
 *
 * `spec.owner` is the fallback, not the source: it is whatever a human typed
 * (`payments`, `Group:default/Payments`, `group:default/payments`) and the
 * catalog collapses all three onto one ref before storing the relation.
 * Comparing the raw string is how this gate came to refuse deletes on resources
 * the same person could see. The fallback still exists because relations are
 * derived — an entity picked up between ingestion and stitching has none — and
 * normalising `spec.owner` the way the catalog would is a better answer there
 * than treating the resource as ownerless.
 */
const ownersOf = (entity: Entity): string[] => {
  const ownedBy =
    entity.relations
      ?.filter(r => r.type === 'ownedBy')
      .map(r => r.targetRef) ?? [];
  const raw =
    ownedBy.length || typeof entity.spec?.owner !== 'string'
      ? ownedBy
      : [entity.spec.owner];
  return raw.map(r => normalizeEntityRef(r, 'Group'));
};

/** What {@link createMayDeleteLookup} needs from the plugin around it. */
export interface MayDeleteDeps {
  catalog: CatalogService;
  auth: AuthService;
  logger: LoggerService;
  /** `platform.catalog.namespace` — where Resources and Users are ingested. */
  catalogNamespace: string;
  /** resourceType -> service-owner, cached by the caller. */
  serviceOwners: () => Promise<ServiceOwnerMap>;
}

/**
 * Bulk-delete ownership for a requester named by ref (see `adminLookup`'s
 * comment — the Scaffolder posts as a service and names the human in
 * `requester`). Answers the same union the RBAC policy's catalog gate does: the
 * resourceType's service-owner, or the caller owning every named resource —
 * admin is handled by the router's separate `adminLookup` call, so it is not
 * re-checked here.
 *
 * Lives in its own file, and takes its dependencies rather than closing over
 * them, so the rule has real tests. Stubbed behind the router's option it was
 * unreachable from any test, and the owner branch — the one that decides
 * whether a destructive Git-writing request is accepted — was never executed at
 * all.
 *
 * ponytail: direct `memberOf` relations only, same limitation as `adminLookup`
 * — a nested-group owner or service-owner fails closed here rather than being
 * denied incorrectly; walk relations transitively (or reuse
 * `principalResolver`'s ownershipEntityRefs machinery) if that needs to agree
 * with the RBAC policy's own nested-group handling too.
 */
export function createMayDeleteLookup(deps: MayDeleteDeps) {
  const { catalog, auth, logger, catalogNamespace, serviceOwners } = deps;

  return async (
    userRef: string,
    resourceType: string,
    resourceNames: string[],
  ): Promise<MayDeleteVerdict> => {
    try {
      const selfRef = `user:${catalogNamespace}/${userRef}`;
      const entity = await catalog.getEntityByRef(selfRef, {
        credentials: await auth.getOwnServiceCredentials(),
      });
      const groups =
        entity?.relations
          ?.filter(r => r.type === 'memberOf')
          .map(r => r.targetRef) ?? [];

      if (
        serviceOwnedTypes(await serviceOwners(), groups).includes(resourceType)
      ) {
        return { allowed: true, denied: [] };
      }

      // Direct ownership: every named resource must be owned by this user or a
      // group they belong to (owner is per resource, not per type — unlike
      // service-ownership above). Normalised on both sides, so this answers the
      // same question `isEntityOwner` answers about visibility.
      const ownerRefs = new Set(
        [...groups, selfRef].map(r => normalizeEntityRef(r, 'Group')),
      );
      const credentials = await auth.getOwnServiceCredentials();
      const resources = await Promise.all(
        resourceNames.map(name =>
          catalog.getEntityByRef(resourceRef(catalogNamespace, name), {
            credentials,
          }),
        ),
      );
      // Every name that failed, not just the first: the refusal reads them
      // back, and a user who ticked five boxes should not have to discover the
      // second offender by resubmitting.
      const denied = resourceNames.filter((_, i) => {
        const r = resources[i];
        return r === undefined || !ownersOf(r).some(o => ownerRefs.has(o));
      });
      return { allowed: denied.length === 0, denied };
    } catch (e) {
      logger.warn(`mayDeleteLookup failed for '${resourceType}': ${e}`);
      // Fails closed, and blames the whole batch — nothing was established
      // about any single name, so naming a subset would be a guess.
      return { allowed: false, denied: resourceNames };
    }
  };
}
