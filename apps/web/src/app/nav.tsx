import { Link } from '@tanstack/react-router'
import { login, logout, useAuth } from '@/lib/auth'
import { NotificationBell } from './notifications/bell'

function AuthControl() {
  const { principal } = useAuth()
  return principal ? (
    <div className="flex items-center gap-2 text-sm">
      <span>{principal.username}</span>
      <button className="underline" onClick={() => logout()}>
        Logout
      </button>
    </div>
  ) : (
    <button className="text-sm underline" onClick={() => login()}>
      Login
    </button>
  )
}

const linkClass = 'text-sm text-gray-700 hover:underline'
// aria-current + a visual cue on the active link, applied by Link itself when the route matches.
const activeLinkProps = {
  className: `${linkClass} font-semibold underline`,
  'aria-current': 'page' as const,
}

// Persistent top nav: brand + role-gated section links + notification bell +
// login/logout. Uses <Link> (client-side nav) everywhere, never <a href> — a
// hard navigation would wipe the in-memory access token (see lib/auth.ts).
// Display-only gating: hiding a link never substitutes for server-side authz.
export function NavBar() {
  const { principal, hasRole } = useAuth()
  // ponytail: there's no distinct "approver" role — approval eligibility is
  // owner-team membership or platform-admin (see bff/app/requests/authz.py).
  const canApprove = hasRole('platform-admin') || (principal?.teams.length ?? 0) > 0

  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
      <nav aria-label="Main" className="flex items-center gap-4">
        <Link
          to="/"
          className="font-semibold"
          activeProps={{ className: 'font-semibold', 'aria-current': 'page' as const }}
        >
          Platform
        </Link>
        {principal && (
          <>
            <Link to="/resources" className={linkClass} activeProps={activeLinkProps}>
              Resources
            </Link>
            <Link to="/requests" className={linkClass} activeProps={activeLinkProps}>
              My Requests
            </Link>
            {canApprove && (
              <Link to="/requests/queue" className={linkClass} activeProps={activeLinkProps}>
                Approvals
              </Link>
            )}
            {hasRole('service-owner') && (
              <Link to="/builder" className={linkClass} activeProps={activeLinkProps}>
                Service Builder
              </Link>
            )}
            {hasRole('platform-admin') && (
              <Link to="/admin" className={linkClass} activeProps={activeLinkProps}>
                Admin
              </Link>
            )}
          </>
        )}
      </nav>
      <div className="flex items-center gap-4">
        {principal && <NotificationBell />}
        <AuthControl />
      </div>
    </header>
  )
}
