import {
  AuthService,
  coreServices,
  createBackendModule,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import {
  AuthorizeResult,
  isResourcePermission,
  PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  catalogConditions,
  createCatalogConditionalDecision,
} from '@backstage/plugin-catalog-backend/alpha';
import { catalogServiceRef, CatalogService } from '@backstage/plugin-catalog-node';
import {
  PLATFORM_PERMISSIONS,
  ServiceOwnerMap,
  serviceOwnedTypes,
  serviceOwnerMap,
} from '@internal/plugin-platform-common';

const DEFAULT_ADMIN_GROUPS = ['group:default/platform-admins'];
const DEFAULT_AUDITOR_GROUPS = ['group:default/platform-auditors'];

// ponytail: matches TREE_TTL_MS in plugin-ui/src/treeStore.ts — this repo's
// existing convention for "short enough that an edit lands quickly, long
// enough to spare a catalog query on every permission check".
const SERVICE_OWNERS_TTL_MS = 30_000;

const RESOURCE_TYPE_ANNOTATION = 'platform.io/resource-type';

/**
 * Coarse gate on the identity's ownershipEntityRefs:
 * - approve/create/delete requests, or mint a presigned upload → anyone
 *   except a pure auditor (auditor = read-only)
 * - everything else → allow (read, catalog, scaffolder, …)
 *
 * Delete shares approve's branch rather than getting its own. The catch-all
 * below is ALLOW, so a permission name listed nowhere is permitted for
 * everyone, auditors included — a separate branch would be fail-open the moment
 * someone forgot it. Splitting delete out later (admin-only, say) is a
 * deliberate edit to a name that already exists.
 *
 * The admin/auditor group sets are configurable (`platform.rbac.adminGroups`,
 * `platform.rbac.auditorGroups`), so multiple groups can map to either. Per-team
 * approval (only the owning service team, or an admin, may decide a given
 * request) is enforced in the requests state machine, which has the request's
 * ownerGroup — this policy only knows the permission name.
 */
export class PlatformPermissionPolicy implements PermissionPolicy {
  private cachedServiceOwners?: { map: ServiceOwnerMap; expiresAt: number };

  constructor(
    private readonly adminGroups: string[],
    private readonly auditorGroups: string[],
    private readonly catalog: CatalogService,
    private readonly auth: AuthService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * The resource-type -> service-owner map, built from every Template's
   * `platform.io/resource-type` annotation. Cached with a short TTL: this
   * runs on every `catalog.entity.read`, and an uncached catalog query per
   * read would be a bigger regression than the visibility bug this gates.
   */
  private async serviceOwners(): Promise<ServiceOwnerMap> {
    const now = Date.now();
    if (this.cachedServiceOwners && this.cachedServiceOwners.expiresAt > now) {
      return this.cachedServiceOwners.map;
    }
    // ponytail: fail closed, not open. A catalog error returns an empty map
    // (so serviceOwnedTypes finds nothing and only entity-ownership still
    // lets anyone through) rather than propagating an unhandled rejection
    // out of handle(), which would surface as a 500. Not cached: a
    // transient failure should retry on the next read, not stay empty for
    // the TTL.
    try {
      const { items } = await this.catalog.getEntities(
        { filter: { kind: 'template' } },
        { credentials: await this.auth.getOwnServiceCredentials() },
      );
      const map = serviceOwnerMap(
        items.map(t => ({
          metadata: {
            name: t.metadata.name,
            annotations: t.metadata.annotations,
          },
          spec: {
            owner: typeof t.spec?.owner === 'string' ? t.spec.owner : undefined,
          },
        })),
      );
      this.cachedServiceOwners = { map, expiresAt: now + SERVICE_OWNERS_TTL_MS };
      return map;
    } catch (e) {
      this.logger.warn(`serviceOwners failed to fetch templates: ${e}`);
      return new Map();
    }
  }

  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const refs = new Set(user?.info?.ownershipEntityRefs ?? []);
    const isAdmin = this.adminGroups.some(g => refs.has(g));
    const isAuditor = this.auditorGroups.some(g => refs.has(g));
    const name = request.permission.name;

    if (
      name === PLATFORM_PERMISSIONS.requestApprove ||
      name === PLATFORM_PERMISSIONS.requestCreate ||
      name === PLATFORM_PERMISSIONS.requestDelete ||
      name === PLATFORM_PERMISSIONS.uploadCreate
    ) {
      return {
        result:
          isAuditor && !isAdmin ? AuthorizeResult.DENY : AuthorizeResult.ALLOW,
      };
    }

    // A platform Resource may be seen by an admin, its own owner, or the
    // service-owner of its resource type — never by a bare ALLOW. The two
    // leading `anyOf` clauses are what keep this a gate on platform Resources
    // rather than a catalog lockdown, and it takes both:
    //   - not `kind: Resource` → not ours. This is the load-bearing one.
    //     `platform.io/resource-type` is authored ON TEMPLATES (it is how a
    //     Template declares which type it provisions), so an annotation check
    //     alone hides every template from every non-owner — an empty /create
    //     and a 404 from the scaffolder's own getEntityByRef.
    //   - no `platform.io/resource-type` annotation → a Resource we do not
    //     manage (hand-authored, another plugin's), left as it was.
    if (isResourcePermission(request.permission, 'catalog-entity')) {
      if (isAdmin) return { result: AuthorizeResult.ALLOW };

      const refList = [...refs];
      const types = serviceOwnedTypes(await this.serviceOwners(), refList);

      return createCatalogConditionalDecision(request.permission, {
        anyOf: [
          { not: catalogConditions.isEntityKind({ kinds: ['Resource'] }) },
          {
            not: catalogConditions.hasAnnotation({
              annotation: RESOURCE_TYPE_ANNOTATION,
            }),
          },
          catalogConditions.isEntityOwner({ claims: refList }),
          ...types.map(t =>
            catalogConditions.hasAnnotation({
              annotation: RESOURCE_TYPE_ANNOTATION,
              value: t,
            }),
          ),
        ],
      });
    }

    return { result: AuthorizeResult.ALLOW };
  }
}

export const permissionModulePlatformRbac = createBackendModule({
  pluginId: 'permission',
  moduleId: 'platform-rbac',
  register(reg) {
    reg.registerInit({
      deps: {
        policy: policyExtensionPoint,
        config: coreServices.rootConfig,
        catalog: catalogServiceRef,
        auth: coreServices.auth,
        logger: coreServices.logger,
      },
      async init({ policy, config, catalog, auth, logger }) {
        policy.setPolicy(
          new PlatformPermissionPolicy(
            config.getOptionalStringArray('platform.rbac.adminGroups') ??
              DEFAULT_ADMIN_GROUPS,
            config.getOptionalStringArray('platform.rbac.auditorGroups') ??
              DEFAULT_AUDITOR_GROUPS,
            catalog,
            auth,
            logger,
          ),
        );
      },
    });
  },
});
