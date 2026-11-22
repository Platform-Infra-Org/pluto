import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';

/** A persistent, one-click sign-out action in the global app bar. */
export function SignOutButton() {
  const identityApi = useApi(identityApiRef);

  return (
    <button
      type="button"
      className="sc-nav-item sc-nav-signout"
      aria-label="Sign out"
      title="Sign out"
      onClick={() => identityApi.signOut()}
    >
      <span className="sc-nav-ic">
        <ExitToAppIcon aria-hidden="true" />
      </span>
      <span className="sc-nav-tx">Sign out</span>
    </button>
  );
}
