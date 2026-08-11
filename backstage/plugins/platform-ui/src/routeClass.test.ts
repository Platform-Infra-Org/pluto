import { routeClassFor } from './routeClass';

describe('routeClassFor', () => {
  it('tags the scaffolder templates grid', () => {
    expect(routeClassFor('/create')).toBe('sc-route-create');
    expect(routeClassFor('/create/templates')).toBe('sc-route-create');
    expect(routeClassFor('/create/templates/x')).toBe('sc-route-create');
  });

  it('gives the task page its own class rather than the templates one', () => {
    expect(routeClassFor('/create/tasks/abc')).toBe('sc-route-task');
    expect(routeClassFor('/create/tasks')).toBe('sc-route-task');
  });

  it('does not tag pages that merely start with the same letters', () => {
    expect(routeClassFor('/created')).toBeUndefined();
    expect(routeClassFor('/catalog')).toBeUndefined();
  });

  it('tags the API explorer, whose header and body use different gutters', () => {
    expect(routeClassFor('/api-docs')).toBe('sc-route-api-docs');
  });

  it('handles the root and trailing slashes', () => {
    expect(routeClassFor('/')).toBeUndefined();
    expect(routeClassFor('/create/')).toBe('sc-route-create');
  });
});
