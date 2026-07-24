// OIDC Authorization Code + PKCE login against Keycloak, plus the auth context.
// Authorization is enforced by the BFF; everything here is for login + display.
import { createContext, useContext } from 'react'
import { InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { setAccessToken } from './token'

export interface Principal {
  sub: string
  username: string
  groups: string[]
  roles: string[]
  teams: string[]
}

export interface AuthState {
  principal: Principal | null
  isLoading: boolean
  hasRole: (role: string) => boolean
  refresh: () => Promise<void>
}

// Lazily constructed so importing this module never touches window/env (e.g. in tests).
let _um: UserManager | null = null
export function userManager(): UserManager {
  if (!_um) {
    _um = new UserManager({
      authority: import.meta.env.VITE_OIDC_ISSUER_URL,
      client_id: import.meta.env.VITE_OIDC_CLIENT_ID_SPA,
      redirect_uri: `${window.location.origin}/auth/callback`,
      // After a Keycloak logout, return the user to the app home page.
      post_logout_redirect_uri: `${window.location.origin}/`,
      response_type: 'code',
      // `groups` claim comes from a client-level mapper, not a scope, so we don't
      // request a `groups` scope (Keycloak rejects unregistered scope names).
      scope: 'openid profile',
      // Access token kept in memory only (never sessionStorage/localStorage, which
      // XSS can read). There's no BFF session/refresh endpoint: a full page reload
      // loses the token and requires re-login (accepted limitation).
      userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    })
  }
  return _um
}

export function login(): Promise<void> {
  return userManager().signinRedirect()
}

export function logout(): Promise<void> {
  setAccessToken(null)
  return userManager().signoutRedirect()
}

// Finish the PKCE redirect; call from the /auth/callback route.
export async function completeLogin(): Promise<void> {
  const user = await userManager().signinRedirectCallback()
  setAccessToken(user.access_token ?? null)
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
