import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { PLATFORM_PERMISSIONS } from '@internal/plugin-platform-common';
import { PlatformPermissionPolicy } from './module';

const policy = new PlatformPermissionPolicy();

function userWith(refs: string[]) {
  return {
    info: { userEntityRef: 'user:default/x', ownershipEntityRefs: refs },
  } as any;
}

const query = (name: string) => ({ permission: { name } }) as any;

describe('PlatformPermissionPolicy', () => {
  it('allows approve only for platform-admins', async () => {
    const admin = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestApprove),
      userWith(['group:default/platform-admins']),
    );
    const other = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestApprove),
      userWith(['group:default/owners-payments']),
    );
    expect(admin.result).toBe(AuthorizeResult.ALLOW);
    expect(other.result).toBe(AuthorizeResult.DENY);
  });

  it('denies create for a pure auditor but allows others', async () => {
    const auditor = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith(['group:default/platform-auditors']),
    );
    const requester = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith(['group:default/owners-payments']),
    );
    const adminAuditor = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestCreate),
      userWith([
        'group:default/platform-auditors',
        'group:default/platform-admins',
      ]),
    );
    expect(auditor.result).toBe(AuthorizeResult.DENY);
    expect(requester.result).toBe(AuthorizeResult.ALLOW);
    expect(adminAuditor.result).toBe(AuthorizeResult.ALLOW);
  });

  it('allows unrelated permissions (read) for anyone', async () => {
    const res = await policy.handle(
      query(PLATFORM_PERMISSIONS.requestRead),
      userWith([]),
    );
    expect(res.result).toBe(AuthorizeResult.ALLOW);
  });
});
