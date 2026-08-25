import {
  DEFAULT_NAMESPACE,
  catalogPath,
  normalizeEntityRef,
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

describe('normalizeEntityRef', () => {
  // The catalog runs every owner through parseEntityRef + stringifyEntityRef
  // before it becomes a `relations.ownedBy` targetRef, so these are the forms
  // that must all collapse onto one string.
  it.each([
    ['payments', 'group:default/payments'],
    ['Group:default/Payments', 'group:default/payments'],
    ['group:default/payments', 'group:default/payments'],
    ['default/payments', 'group:default/payments'],
    ['group:platform/payments', 'group:platform/payments'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeEntityRef(input, 'Group')).toBe(expected);
  });

  it('keeps an explicit kind rather than defaulting it', () => {
    expect(normalizeEntityRef('user:default/dana', 'Group')).toBe(
      'user:default/dana',
    );
  });

  it('does not throw on a malformed ref', () => {
    // An authorization gate must return "matches nothing", never a 500.
    expect(() => normalizeEntityRef('', 'Group')).not.toThrow();
  });
});
