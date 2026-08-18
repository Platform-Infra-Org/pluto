import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import {
  AuthorizeResult,
  PolicyDecision,
} from '@backstage/plugin-permission-common';
import { PLATFORM_PERMISSIONS } from '@internal/plugin-platform-common';

const DEFAULT_ADMIN_GROUPS = ['group:default/platform-admins'];
const DEFAULT_AUDITOR_GROUPS = ['group:default/platform-auditors'];

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
  constructor(
    private readonly adminGroups: string[],
    private readonly auditorGroups: string[],
  ) {}

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
    return { result: AuthorizeResult.ALLOW };
  }
}

export const permissionModulePlatformRbac = createBackendModule({
  pluginId: 'permission',
  moduleId: 'platform-rbac',
  register(reg) {
    reg.registerInit({
      deps: { policy: policyExtensionPoint, config: coreServices.rootConfig },
      async init({ policy, config }) {
        policy.setPolicy(
          new PlatformPermissionPolicy(
            config.getOptionalStringArray('platform.rbac.adminGroups') ??
              DEFAULT_ADMIN_GROUPS,
            config.getOptionalStringArray('platform.rbac.auditorGroups') ??
              DEFAULT_AUDITOR_GROUPS,
          ),
        );
      },
    });
  },
});
