import { Link } from '@tanstack/react-router'
import { Boxes } from 'lucide-react'
import { login, logout, useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { NotificationBell } from './notifications/bell'
import { ThemeSwitcher } from './theme-switcher'

function AuthControl() {
  const { principal } = useAuth()
  return principal ? (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline">{principal.username}</span>
      <Button variant="outline" size="sm" onClick={() => logout()}>
        Logout
      </Button>
    </div>
  ) : (
    <Button size="sm" onClick={() => login()}>
      Login
    </Button>
  )
}

const linkClass =
  'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
// aria-current + a visual cue on the active link, applied by Link itself when the route matches.
const activeLinkProps = {
  className: 'rounded-md px-3 py-1.5 text-sm font-medium bg-accent text-accent-foreground',
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
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link
            to="/"
            className="mr-2 flex items-center gap-2 text-sm font-semibold tracking-tight"
            activeProps={{ 'aria-current': 'page' as const }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Boxes className="h-4 w-4" />
            </span>
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
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {principal && <NotificationBell />}
          <AuthControl />
        </div>
      </div>
    </header>
  )
}
