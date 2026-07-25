import { createBackendModule } from '@backstage/backend-plugin-api';
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

const ADMIN_GROUP = 'group:default/platform-admins';
const AUDITOR_GROUP = 'group:default/platform-auditors';

/**
 * Coarse gate on the identity's ownershipEntityRefs:
 * - approve/create requests → anyone except a pure auditor (auditor = read-only)
 * - everything else → allow (read, catalog, scaffolder, …)
 *
 * Per-team approval (only the owning service team, or an admin, may decide a
 * given request) is enforced in the requests state machine, which has the
 * request's ownerGroup — this policy only knows the permission name.
 */
export class PlatformPermissionPolicy implements PermissionPolicy {
  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const refs = new Set(user?.info?.ownershipEntityRefs ?? []);
    const isAdmin = refs.has(ADMIN_GROUP);
    const isAuditor = refs.has(AUDITOR_GROUP);
    const name = request.permission.name;

    if (
      name === PLATFORM_PERMISSIONS.requestApprove ||
      name === PLATFORM_PERMISSIONS.requestCreate
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
      deps: { policy: policyExtensionPoint },
      async init({ policy }) {
        policy.setPolicy(new PlatformPermissionPolicy());
      },
    });
  },
});
