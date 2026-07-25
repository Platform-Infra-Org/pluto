import { useEffect, useState } from 'react';
import { Link } from '@backstage/core-components';
import { NavContentBlueprint } from '@backstage/plugin-app-react';

// The nav renders outside react-router's context, so derive the active path
// from the browser location + history events rather than useLocation().
function useCurrentPath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    const { pushState, replaceState } = window.history;
    const wrap =
      (fn: typeof pushState) =>
      function (this: History, ...args: Parameters<typeof pushState>) {
        const r = fn.apply(this, args);
        update();
        return r;
      };
    window.history.pushState = wrap(pushState);
    window.history.replaceState = wrap(replaceState);
    return () => {
      window.removeEventListener('popstate', update);
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
    };
  }, []);
  return path;
}

function isActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * A fully custom shadcn-style left nav that replaces the Backstage sidebar.
 * Follows the color-scheme picker (active item uses `--sc-primary`) and sits in
 * the layout's reserved gutter (content padding forced to match in styles.ts).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomNav({ navItems }: { navItems: any }) {
  const pathname = useCurrentPath();
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('platform-nav-collapsed') === '1',
  );

  // Drive both the nav width and the content gutter from one variable so they
  // stay aligned; persist the choice.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sc-nav-w',
      collapsed ? '68px' : '240px',
    );
    try {
      localStorage.setItem('platform-nav-collapsed', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // withComponent maps each discovered nav item (icon node + href + title) to
  // our shadcn link; rest() returns them all (sorted).
  const bag = navItems.withComponent((item: any) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        to={item.href}
        title={item.title}
        className={`sc-nav-item${active ? ' active' : ''}`}
      >
        <span className="sc-nav-ic">{item.icon}</span>
        <span className="sc-nav-tx">{item.title}</span>
      </Link>
    );
  });

  return (
    <aside className={`sc sc-nav${collapsed ? ' collapsed' : ''}`} aria-label="Main">
      <div className="sc-nav-top">
        <Link to="/" className="sc-nav-brand">
          <span className="sc-nav-mark" />
          <span className="sc-nav-word">Platform</span>
        </Link>
        <button
          type="button"
          className="sc-nav-toggle"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>
      <nav className="sc-nav-list">{bag.rest({ sortBy: 'title' })}</nav>
    </aside>
  );
}

export const navContent = NavContentBlueprint.make({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: { component: ({ navItems }: any) => <CustomNav navItems={navItems} /> },
});
