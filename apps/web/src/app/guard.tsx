import { useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '../lib/api'
import { AuthContext, login, useAuth, type Principal } from '../lib/auth'

// Loads the current principal from the BFF (/api/me — the server is the gate)
// and exposes it via context. Roles here drive display only.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [principal, setPrincipal] = useState<Principal | null>(null)
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<Principal>('/me')
      .then(setPrincipal)
      .catch(() => setPrincipal(null))
      .finally(() => setLoading(false))
  }, [])

  const hasRole = (role: string) => !!principal?.roles.includes(role)

  return (
    <AuthContext.Provider value={{ principal, isLoading, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// Route guard: sends unauthenticated users through the OIDC login redirect.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { principal, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !principal) login()
  }, [isLoading, principal])

  if (isLoading) return <div>Loading…</div>
  if (!principal) return null
  return <>{children}</>
}

// Show children only if the user has the role. Display-only — never a security boundary.
export function RoleGate({ role, children }: { role: string; children: ReactNode }) {
  const { hasRole } = useAuth()
  return hasRole(role) ? <>{children}</> : null
}
