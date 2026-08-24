import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { MaintenancePage } from './MaintenancePage';
import { useMaintenance } from './useMaintenance';
import { useIsAdmin } from './useIsAdmin';

// Matches '/create' itself and everything under it (the template picker and
// the multi-step form both live under this prefix) — but not e.g. '/created'.
function isRequestFormRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/create' || path.startsWith('/create/');
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
