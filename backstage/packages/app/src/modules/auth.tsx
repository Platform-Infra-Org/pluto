import {
  ApiBlueprint,
  createApiRef,
  createFrontendModule,
  discoveryApiRef,
  oauthRequestApiRef,
  configApiRef,
} from '@backstage/frontend-plugin-api';
import {
  OAuthApi,
  OpenIdConnectApi,
  ProfileInfoApi,
  BackstageIdentityApi,
  SessionApi,
} from '@backstage/core-plugin-api';
import { OAuth2 } from '@backstage/core-app-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import { UserIdentity } from '@backstage/core-components';
import {
  errorApiRef,
  useApi,
  type SignInPageProps,
} from '@backstage/core-plugin-api';
import { Button, SchemePicker, PlatformMark } from '@internal/plugin-platform-ui';
import { useEffect, useState } from 'react';

// Custom auth API for the generic OIDC (Keycloak) provider — Backstage ships no
// built-in oidcAuthApiRef, so the app defines one and wires it to the backend's
// `oidc` provider.
export const oidcAuthApiRef = createApiRef<
  OAuthApi &
    OpenIdConnectApi &
    ProfileInfoApi &
    BackstageIdentityApi &
    SessionApi
>({ id: 'auth.oidc' });

const oidcAuthApi = ApiBlueprint.make({
  name: 'oidc',
  params: defineParams =>
    defineParams({
      api: oidcAuthApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        oauthRequestApi: oauthRequestApiRef,
        configApi: configApiRef,
      },
      factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
        OAuth2.create({
          configApi,
          discoveryApi,
          oauthRequestApi,
          provider: {
            id: 'oidc',
            title: 'Keycloak',
            icon: () => null,
          },
          environment: configApi.getOptionalString('auth.environment'),
          // No 'groups' scope: Keycloak exposes groups via a token mapper, not a
          // client scope, so requesting it would fail with invalid_scope.
          defaultScopes: ['openid', 'profile', 'email'],
          popupOptions: { size: { width: 600, height: 700 } },
        }),
    }),
});

// Custom sign-in page: fully shadcn-themed so the accent (brand mark + button)
// follows the color picker — which is rendered right on the login screen.
function PlatformSignInPage(props: SignInPageProps) {
  const oidc = useApi(oidcAuthApiRef);
  const errorApi = useApi(errorApiRef);
  const [busy, setBusy] = useState(false);
  // On load, silently restore an existing session (refresh token) instead of
  // forcing a fresh login on every page refresh. `optional: true` never pops up.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    oidc
      .getBackstageIdentity({ optional: true })
      .then(id => {
        if (cancelled) return;
        if (id) {
          props.onSignInSuccess(
            UserIdentity.create({ identity: id.identity, authApi: oidc }),
          );
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
    // Run once on mount; onSignInSuccess must fire at most once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oidc]);

  const signIn = async () => {
    setBusy(true);
    try {
      const id = await oidc.getBackstageIdentity({ instantPopup: true });
      if (id) {
        props.onSignInSuccess(
          UserIdentity.create({ identity: id.identity, authApi: oidc }),
        );
      }
    } catch (e) {
      errorApi.post(e as Error);
    } finally {
      setBusy(false);
    }
  };

  // While restoring a session, don't flash the login card.
  if (checking) {
    return (
      <div className="sc sc-login">
        <div className="sc-login-card">
          <div className="sc-login-mark">
            <PlatformMark />
          </div>
          <p className="sc-login-sub">Signing you in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sc sc-login">
      <div className="sc-login-card">
        <div className="sc-login-mark">
          <PlatformMark />
        </div>
        <h1 className="sc-login-title">Platform</h1>
        {/* The one screen where game copy costs nothing: no task is in flight
            and no state is being reported. The button keeps its literal label,
            so the actionable text stays honest — only the decoration plays. */}
        <p className="sc-login-sub sc-press-start">Press start</p>
        <Button onClick={signIn} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in with Keycloak'}
        </Button>
        <div className="sc-login-pick">
          <SchemePicker />
        </div>
      </div>
    </div>
  );
}

const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => (props: SignInPageProps) =>
      <PlatformSignInPage {...props} />,
  },
});

export const authModule = createFrontendModule({
  pluginId: 'app',
  extensions: [oidcAuthApi, signInPage],
});
