import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';

/** A persistent, one-click sign-out action in the global app bar. */
export function SignOutButton() {
  const identityApi = useApi(identityApiRef);

  return (
    <button
      type="button"
      className="sc-topbar-action sc-sign-out"
      aria-label="Sign out"
      title="Sign out"
      onClick={() => identityApi.signOut()}
    >
      <ExitToAppIcon aria-hidden="true" />
    </button>
  );
}
