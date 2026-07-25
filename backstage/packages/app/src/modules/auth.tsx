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
import { SignInPage } from '@backstage/core-components';

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
          defaultScopes: ['openid', 'profile', 'email', 'groups'],
          popupOptions: { size: { width: 600, height: 700 } },
        }),
    }),
});

const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => (props: any) =>
      (
        <SignInPage
          {...props}
          providers={[
            {
              id: 'oidc',
              title: 'Keycloak',
              message: 'Sign in with your platform account',
              apiRef: oidcAuthApiRef,
            },
          ]}
        />
      ),
  },
});

export const authModule = createFrontendModule({
  pluginId: 'app',
  extensions: [oidcAuthApi, signInPage],
});
