import { useEffect, useState } from 'react';
import {
  configApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';

/** Matches the backend policy's default (see the platform-rbac module). */
const DEFAULT_ADMIN_GROUPS = ['group:default/platform-admins'];

/**
 * Is the signed-in user a platform admin?
 *
 * The same check the backend permission policy makes — membership of a
 * `platform.rbac.adminGroups` group, compared exactly, as there — so the two
 * cannot drift into disagreeing about who is an admin. `undefined` while the
 * identity is still resolving.
 */
export function useIsAdmin(): boolean | undefined {
  const config = useApi(configApiRef);
  const identity = useApi(identityApiRef);
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>();

  useEffect(() => {
    const adminGroups =
      config.getOptionalStringArray('platform.rbac.adminGroups') ??
      DEFAULT_ADMIN_GROUPS;
    let live = true;
    identity
      .getBackstageIdentity()
      .then(i => {
        if (live)
          setIsAdmin(i.ownershipEntityRefs.some(g => adminGroups.includes(g)));
      })
      // No identity is not an error worth surfacing in the nav; it just isn't
      // an admin.
      .catch(() => live && setIsAdmin(false));
    return () => {
      live = false;
    };
  }, [config, identity]);

  return isAdmin;
}
