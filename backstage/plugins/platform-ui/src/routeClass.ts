/**
 * A root class per route, so CSS can scope a rule to one page.
 *
 * Material-UI drops a component's `makeStyles` name in production builds —
 * `BackstageItemCardGrid-root` becomes `jss86` — so a selector cannot name the
 * scaffolder's card grid. Only `Mui*` classes survive, and those are far too
 * general to style on their own: `.MuiCard-root` is every card in the app.
 * Scoping by route is what makes a general selector specific again.
 */
const ROUTES: Array<{ prefix: string; className: string }> = [
  { prefix: '/create', className: 'sc-route-create' },
];

export function routeClassFor(pathname: string): string | undefined {
  // Trailing slash stripped so '/create/' and '/create' agree; the boundary
  // check is what keeps '/created' from matching '/create'.
  const path = pathname.replace(/\/+$/, '') || '/';
  return ROUTES.find(
    r => path === r.prefix || path.startsWith(`${r.prefix}/`),
  )?.className;
}

/** Every class this module can set, for cleanup before applying the next. */
export const ALL_ROUTE_CLASSES = ROUTES.map(r => r.className);
