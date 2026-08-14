import { createPermission } from '@backstage/plugin-permission-common';
import { PLATFORM_PERMISSIONS } from '@internal/plugin-platform-common';

export const requestCreatePermission = createPermission({
  name: PLATFORM_PERMISSIONS.requestCreate,
  attributes: { action: 'create' },
});

export const requestApprovePermission = createPermission({
  name: PLATFORM_PERMISSIONS.requestApprove,
  attributes: { action: 'update' },
});

export const requestReadPermission = createPermission({
  name: PLATFORM_PERMISSIONS.requestRead,
  attributes: { action: 'read' },
});

/**
 * Destroying a request row and its approvals.
 *
 * Its own permission rather than a re-use of `requestApprove`, so an operator
 * can later make deletion admin-only without also locking owning service teams
 * out of approving. The policy currently answers both identically — see the
 * module, where it shares approve's branch so it inherits the auditor DENY.
 */
export const requestDeletePermission = createPermission({
  name: PLATFORM_PERMISSIONS.requestDelete,
  attributes: { action: 'delete' },
});

export const platformPermissions = [
  requestCreatePermission,
  requestApprovePermission,
  requestReadPermission,
  requestDeletePermission,
];
