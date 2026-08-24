import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { MaintenancePage } from './MaintenancePage';
import { useMaintenance } from './useMaintenance';
import { useIsAdmin } from './useIsAdmin';
import { routeClassFor } from './routeClass';

// '/create/tasks' is carved back out: it's where someone watches a run they
// already submitted, not a form the backend would reject. The 503 in
// platform-requests-backend is on POST /requests only — approvals, re-checks
// and in-flight workflows are deliberately left alone — so the UI gate has to
// stop at the same boundary, or MaintenancePage's own "already filed is
// unaffected" copy would be shown while hiding exactly that.
//
// The '/create' boundary itself is routeClassFor's — same trailing-slash
// strip, same prefix check it already does for styling; reusing it here
// keeps the one routing rule in one place.
function isRequestFormRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/create/tasks' || path.startsWith('/create/tasks/')) {
    return false;
  }
  return routeClassFor(pathname) === 'sc-route-create';
}

/**
 * Replaces the request form with the maintenance page for non-admins.
 *
 * A wrapper rather than an override of the Scaffolder's own page extension:
 * the page belongs to a plugin we do not own, and wrapping is both cheaper and
 * harder to get silently wrong than replacing someone else's extension.
 *
 * Admins are never gated — filing during maintenance is the point of being
 * able to turn it on. And `undefined` (still loading) renders children: a
 * maintenance page shown while the answer is unknown would flash at every user
 * on every load.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const maintenance = useMaintenance();
  const isAdmin = useIsAdmin();
  const location = useLocation();

  if (maintenance && !isAdmin && isRequestFormRoute(location.pathname)) {
    return <MaintenancePage />;
  }
  return <>{children}</>;
}
