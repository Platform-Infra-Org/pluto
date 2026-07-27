import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { PLATFORM_PERMISSIONS } from '@internal/plugin-platform-common';
import { PlatformPermissionPolicy } from './module';

const policy = new PlatformPermissionPolicy(
  ['group:default/platform-admins'],
  ['group:default/platform-auditors'],
);

function userWith(refs: string[]) {
  return {
    info: { userEntityRef: 'user:default/x', ownershipEntityRefs: refs },
  } as any;
}

const query = (name: string) => ({ permission: { name } }) as any;

describe('PlatformPermissionPolicy', () => {
  it('allows approve/create for anyone except a pure auditor', async () => {
    const admin = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestApprove),
      userWith(['group:default/platform-admins']),
    );
    const owner = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestApprove),
      userWith(['group:default/owners-payments']),
    );
    const auditor = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestApprove),
      userWith(['group:default/platform-auditors']),
    );
    expect(admin.result).toBe(AuthorizeResult.ALLOW);
    expect(owner.result).toBe(AuthorizeResult.ALLOW);
    expect(auditor.result).toBe(AuthorizeResult.DENY);
  });

  it('denies create for a pure auditor but allows an admin+auditor', async () => {
    const auditor = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith(['group:default/platform-auditors']),
    );
    const adminAuditor = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith([
        'group:default/platform-auditors',
        'group:default/platform-admins',
      ]),
    );
    expect(auditor.result).toBe(AuthorizeResult.DENY);
    expect(adminAuditor.result).toBe(AuthorizeResult.ALLOW);
  });

  it('honors configured admin/auditor group sets', async () => {
    const custom = new PlatformPermissionPolicy(
      ['group:default/sre', 'group:default/platform-admins'],
      ['group:default/readonly'],
    );
    // a member of a configured admin group is not blocked even if also readonly
    const sreReadonly = await custom.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith(['group:default/sre', 'group:default/readonly']),
    );
    const readonly = await custom.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith(['group:default/readonly']),
    );
    expect(sreReadonly.result).toBe(AuthorizeResult.ALLOW);
    expect(readonly.result).toBe(AuthorizeResult.DENY);
  });

  it('allows unrelated permissions (read) for anyone', async () => {
    const res = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestRead),
      userWith([]),
    );
    expect(res.result).toBe(AuthorizeResult.ALLOW);
  });
});
