import { isAdminRef } from './maintenance';

describe('isAdminRef', () => {
  const ADMINS = ['group:default/platform-admins'];

  it('is true for a member of an admin group', () => {
    expect(isAdminRef(['group:default/platform-admins', 'group:default/checkout'], ADMINS)).toBe(true);
  });

  it('is false for a member of no admin group', () => {
    expect(isAdminRef(['group:default/checkout'], ADMINS)).toBe(false);
  });

  it('is false for a user with no groups', () => {
    expect(isAdminRef([], ADMINS)).toBe(false);
  });

  it('is false when the user could not be resolved at all', () => {
    // An unknown ref must not fail open — that would let anyone through by
    // naming a user that does not exist.
    expect(isAdminRef(undefined, ADMINS)).toBe(false);
  });

  it('compares refs exactly, as the permission policy does', () => {
    expect(isAdminRef(['group:default/Platform-Admins'], ADMINS)).toBe(false);
  });
});
