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

/**
 * Minting a presigned S3 upload URL (the PlatformFile field).
 *
 * Object *size* and *extension* are capped per-object by `platform.uploads`,
 * but nothing caps object *count* — without this gate any signed-in user
 * could mint unbounded presigned URLs. Its own permission rather than a reuse
 * of `requestCreate`: an upload can happen before the request it belongs to
 * is ever submitted.
 */
export const uploadCreatePermission = createPermission({
  name: PLATFORM_PERMISSIONS.uploadCreate,
  attributes: { action: 'create' },
});

export const platformPermissions = [
  requestCreatePermission,
  requestApprovePermission,
  requestReadPermission,
  requestDeletePermission,
  uploadCreatePermission,
];
