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

export const platformPermissions = [
  requestCreatePermission,
  requestApprovePermission,
  requestReadPermission,
];
