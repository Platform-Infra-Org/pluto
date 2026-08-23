import { ADMIN_NAV_HREFS, navItemVisible } from './navVisibility';

describe('navItemVisible', () => {
  it('offers ordinary routes to everyone', () => {
    for (const isAdmin of [true, false, undefined]) {
      expect(navItemVisible('/catalog', isAdmin)).toBe(true);
      expect(navItemVisible('/create', isAdmin)).toBe(true);
    }
  });

  it('hides the admin routes from non-admins, including while identity loads', () => {
    for (const href of ADMIN_NAV_HREFS) {
      expect(`${href}:${navItemVisible(href, false)}`).toBe(`${href}:false`);
      expect(`${href}:${navItemVisible(href, undefined)}`).toBe(
        `${href}:false`,
      );
      expect(`${href}:${navItemVisible(href, true)}`).toBe(`${href}:true`);
    }
  });

  it('still hides the always-hidden routes from admins', () => {
    expect(navItemVisible('/catalog-graph', true)).toBe(false);
  });
});

describe('grafana-backed routes', () => {
  it('offers /dashboard only when grafana is configured', () => {
    for (const isAdmin of [true, false, undefined]) {
      expect(navItemVisible('/dashboard', isAdmin, true)).toBe(true);
      expect(navItemVisible('/dashboard', isAdmin, false)).toBe(false);
    }
  });

  it('hides /dashboard when nobody says whether grafana is configured', () => {
    // Absent argument means "not configured". A tab that appears and then
    // vanishes is worse than one that appears a beat late.
    expect(navItemVisible('/dashboard', true)).toBe(false);
  });

  it('leaves ordinary routes alone regardless of grafana', () => {
    expect(navItemVisible('/catalog', false, false)).toBe(true);
    expect(navItemVisible('/create', false, false)).toBe(true);
  });
});
