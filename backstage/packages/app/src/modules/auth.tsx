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
import { Button, SchemePicker } from '@internal/plugin-platform-ui';
import { useState } from 'react';

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

  return (
    <div className="sc sc-login">
      <div className="sc-login-card">
        <div className="sc-login-mark" />
        <h1 className="sc-login-title">Platform</h1>
        <p className="sc-login-sub">Sign in to continue</p>
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
