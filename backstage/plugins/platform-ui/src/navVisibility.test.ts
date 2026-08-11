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
