/* eslint-disable jsx-a11y/no-noninteractive-element-interactions,
                  jsx-a11y/no-noninteractive-tabindex --
   The resize handle is an ARIA window splitter: role="separator" that is
   focusable and driven by arrow keys, which is the documented pattern. jsx-a11y
   classes every separator as non-interactive and cannot recognise the splitter
   case, so both rules are disabled for this file only. */
import {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from 'react';
import { Link } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { PlatformMark } from './components';
import { screenName, Flavour } from './flavour';

// The nav renders outside react-router's context, so derive the active path
// from the browser location + history events rather than useLocation().
export function useCurrentPath(): string {
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

/** Width bounds for the draggable nav, in px. */
const NAV_MIN = 180;
const NAV_MAX = 420;
const NAV_DEFAULT = 240;
const NAV_COLLAPSED = 68;

const clampNavWidth = (px: number) =>
  Math.round(Math.min(NAV_MAX, Math.max(NAV_MIN, px)));

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
  const [width, setWidth] = useState(() => {
    const stored =
      typeof localStorage !== 'undefined'
        ? Number(localStorage.getItem('platform-nav-w'))
        : NaN;
    return Number.isFinite(stored) && stored >= NAV_MIN && stored <= NAV_MAX
      ? stored
      : NAV_DEFAULT;
  });
  const [dragging, setDragging] = useState(false);

  // Drive both the nav width and the content gutter from one variable so they
  // stay aligned; persist both the collapse state and the dragged width.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sc-nav-w',
      collapsed ? `${NAV_COLLAPSED}px` : `${width}px`,
    );
    try {
      localStorage.setItem('platform-nav-collapsed', collapsed ? '1' : '0');
      localStorage.setItem('platform-nav-w', String(width));
    } catch {
      /* ignore */
    }
  }, [collapsed, width]);

  // Drag the edge to resize. Pointer capture keeps the drag alive when the
  // cursor leaves the handle, and `.dragging` suspends the width transition so
  // the edge tracks the cursor exactly instead of easing behind it.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (collapsed) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) setWidth(clampNavWidth(e.clientX));
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };
  // Keyboard equivalent: the separator is focusable and moves by arrow key.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 32 : 8;
    if (e.key === 'ArrowLeft') setWidth(w => clampNavWidth(w - step));
    else if (e.key === 'ArrowRight') setWidth(w => clampNavWidth(w + step));
    else if (e.key === 'Home') setWidth(NAV_MIN);
    else if (e.key === 'End') setWidth(NAV_MAX);
    else return;
    e.preventDefault();
  };

  // withComponent maps each discovered nav item (icon node + href + title) to
  // our shadcn link; rest() returns them all (sorted).
  // Screen names only, and only when app.branding.flavour says so. Read through
  // the hook rather than the module-level branding relay: that relay is filled
  // from an effect and mutating it re-injects CSS, which never re-renders this
  // component — the labels would stay literal whatever the config said.
  const config = useApi(configApiRef);
  const flavour: Flavour =
    config.getOptionalString('app.branding.flavour') === 'fantasy'
      ? 'fantasy'
      : undefined;
  const bag = navItems.withComponent((item: any) => {
    const active = isActive(pathname, item.href);
    const label = screenName(item.title, flavour);
    return (
      <Link
        to={item.href}
        title={label}
        className={`sc-nav-item${active ? ' active' : ''}`}
      >
        {/* Non-breaking space when inactive so rows never shift horizontally. */}
        <span className="sc-nav-cursor" aria-hidden="true">
          {active ? '\u25B6' : '\u00A0'}
        </span>
        <span className="sc-nav-ic">{item.icon}</span>
        <span className="sc-nav-tx">{label}</span>
      </Link>
    );
  });

  return (
    <aside
      className={`sc sc-nav${collapsed ? ' collapsed' : ''}${dragging ? ' dragging' : ''}`}
      aria-label="Main"
    >
      <div className="sc-nav-top">
        <Link to="/" className="sc-nav-brand">
          <span className="sc-nav-mark">
            <PlatformMark />
          </span>
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
      <nav className="sc-nav-list">
        {/* Home pinned first; everything else follows, alphabetically. */}
        {bag.take('page:platform-requests/home')}
        {bag.rest({ sortBy: 'title' })}
      </nav>
      {!collapsed && (
        <div
          className="sc-nav-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={width}
          aria-valuemin={NAV_MIN}
          aria-valuemax={NAV_MAX}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          onDoubleClick={() => setWidth(NAV_DEFAULT)}
          title="Drag to resize — double-click to reset"
        />
      )}
    </aside>
  );
}

export const navContent = NavContentBlueprint.make({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: { component: ({ navItems }: any) => <CustomNav navItems={navItems} /> },
});
