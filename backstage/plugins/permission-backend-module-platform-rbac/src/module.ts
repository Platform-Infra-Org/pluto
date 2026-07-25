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
const SERVICE_OWNER_GROUP = 'group:default/service-owner';

/**
 * Maps Keycloak group membership (carried on the identity's ownershipEntityRefs)
 * to platform permission decisions:
 * - approve requests → platform-admins or service-owners
 * - create requests → anyone except a pure auditor (auditor = read-only)
 * - everything else → allow (read, catalog, scaffolder, …)
 */
export class PlatformPermissionPolicy implements PermissionPolicy {
  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const refs = new Set(user?.info?.ownershipEntityRefs ?? []);
    const isAdmin = refs.has(ADMIN_GROUP);
    const isServiceOwner = refs.has(SERVICE_OWNER_GROUP);
    const isAuditor = refs.has(AUDITOR_GROUP);
    const name = request.permission.name;

    if (name === PLATFORM_PERMISSIONS.requestApprove) {
      return {
        result:
          isAdmin || isServiceOwner
            ? AuthorizeResult.ALLOW
            : AuthorizeResult.DENY,
      };
    }
    if (name === PLATFORM_PERMISSIONS.requestCreate) {
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
