import { routeClassFor } from './routeClass';

describe('routeClassFor', () => {
  it('tags the scaffolder templates grid', () => {
    expect(routeClassFor('/create')).toBe('sc-route-create');
    expect(routeClassFor('/create/templates')).toBe('sc-route-create');
  });

  it('does not tag pages that merely start with the same letters', () => {
    expect(routeClassFor('/created')).toBeUndefined();
    expect(routeClassFor('/catalog')).toBeUndefined();
  });

  it('handles the root and trailing slashes', () => {
    expect(routeClassFor('/')).toBeUndefined();
    expect(routeClassFor('/create/')).toBe('sc-route-create');
  });
});
