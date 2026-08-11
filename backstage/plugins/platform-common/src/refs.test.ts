import {
  DEFAULT_NAMESPACE,
  catalogPath,
  resourceRef,
  userRef,
} from './refs';

describe('ref helpers', () => {
  it('builds a resource ref', () => {
    expect(resourceRef(DEFAULT_NAMESPACE, 'orders-db')).toBe(
      'resource:default/orders-db',
    );
  });

  it('builds a user ref', () => {
    expect(userRef(DEFAULT_NAMESPACE, 'alice')).toBe('user:default/alice');
  });

  it('builds a catalog path', () => {
    expect(catalogPath(DEFAULT_NAMESPACE, 'resource', 'orders-db')).toBe(
      '/catalog/default/resource/orders-db',
    );
  });

  // The whole point of the exercise: a deployment that ingests somewhere else
  // gets its namespace through, rather than the literal these replaced.
  it('honours a non-default namespace everywhere', () => {
    expect(resourceRef('platform', 'orders-db')).toBe(
      'resource:platform/orders-db',
    );
    expect(userRef('platform', 'alice')).toBe('user:platform/alice');
    expect(catalogPath('platform', 'user', 'alice')).toBe(
      '/catalog/platform/user/alice',
    );
  });

  it('defaults to the namespace Backstage itself defaults to', () => {
    expect(DEFAULT_NAMESPACE).toBe('default');
  });
});
