/** Pluto settings navigation. The routes are owned by existing Backstage subpages. */
import { Link } from '@backstage/core-components';
import { useCurrentPath } from './CustomNav';

const settingsPages = [
  { path: 'general', label: 'General' },
  { path: 'auth-providers', label: 'Authentication Providers' },
  { path: 'feature-flags', label: 'Feature Flags' },
  { path: 'maintenance', label: 'Maintenance' },
  { path: 'ai-chat', label: 'AI Chat' },
] as const;

export function SettingsNavigation() {
  const pathname = useCurrentPath();
  if (pathname !== '/settings' && !pathname.startsWith('/settings/'))
    return null;

  return (
    <nav className="sc-settings-navigation" aria-label="Settings sections">
      {settingsPages.map(({ path, label }) => {
        const target = `/settings/${path}`;
        const active =
          pathname === target ||
          pathname.startsWith(`${target}/`) ||
          (pathname === '/settings' && path === 'general');
        return (
          <Link
            key={path}
            to={target}
            className={`sc-settings-navigation-link${
              active ? ' is-active' : ''
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
