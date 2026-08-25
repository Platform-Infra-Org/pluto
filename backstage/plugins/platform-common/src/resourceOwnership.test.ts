import { serviceOwnerMap, serviceOwnedTypes } from './resourceOwnership';

const tpl = (
  type: string | undefined,
  owner: string | undefined,
  opts?: { name?: string },
) => ({
  metadata: {
    ...(opts?.name ? { name: opts.name } : {}),
    ...(type ? { annotations: { 'platform.io/resource-type': type } } : {}),
  },
  spec: { ...(owner ? { owner } : {}) },
});

describe('serviceOwnerMap', () => {
  it('maps a resource-type to its template owner', () => {
    const m = serviceOwnerMap([tpl('git-resource', 'group:default/checkout')]);
    expect(m.get('git-resource')).toBe('group:default/checkout');
  });

  it('ignores a template that claims no resource-type', () => {
    // bulk-delete-resources deliberately carries no platform.io/resource-type,
    // so that it cannot shadow the real owner of git-resource.
    expect(serviceOwnerMap([tpl(undefined, 'group:default/checkout')]).size).toBe(0);
  });

  it('ignores a template with no owner', () => {
    expect(serviceOwnerMap([tpl('db', undefined)]).size).toBe(0);
  });

  it('keeps the first template when two claim the same type', () => {
    // Two templates claiming one type is a misconfiguration the backend already
    // warns about elsewhere; picking deterministically beats picking at random.
    const m = serviceOwnerMap([
      tpl('db', 'group:default/a'),
      tpl('db', 'group:default/b'),
    ]);
    expect(m.get('db')).toBe('group:default/a');
  });

  it('falls back to metadata.name when annotation is absent', () => {
    // Same lookup as ownerResolver: annotation first, name as fallback.
    const m = serviceOwnerMap([tpl(undefined, 'group:default/checkout', { name: 'git-resource' })]);
    expect(m.get('git-resource')).toBe('group:default/checkout');
  });

  it('prefers annotation over name when both exist', () => {
    // Annotation takes precedence regardless of catalog ordering; a template
    // with both should use the annotation, not the name. This would be a
    // misconfiguration, but annotation-first ensures deterministic results.
    const m = serviceOwnerMap([
      tpl('annotated-type', 'group:default/checkout', { name: 'git-resource' }),
      tpl(undefined, 'group:default/payments', { name: 'annotated-type' }),
    ]);
    expect(m.get('annotated-type')).toBe('group:default/checkout');
  });
});

describe('serviceOwnedTypes', () => {
  const map = new Map([
    ['git-resource', 'group:default/checkout'],
    ['database', 'group:default/payments'],
  ]);

  it('lists the types a group service-owns', () => {
    expect(serviceOwnedTypes(map, ['group:default/checkout'])).toEqual(['git-resource']);
  });

  it('lists every type across several groups', () => {
    expect(
      serviceOwnedTypes(map, ['group:default/checkout', 'group:default/payments']).sort(),
    ).toEqual(['database', 'git-resource']);
  });

  it('is empty for a group that owns nothing', () => {
    expect(serviceOwnedTypes(map, ['group:default/nobody'])).toEqual([]);
  });

  it('matches a ref whose case differs, as the catalog does', () => {
    // relations.ownedBy is lowercased by stringifyEntityRef before the catalog
    // ever stores it, so `Group:default/Checkout` and `group:default/checkout`
    // are one group to the rule that decides visibility. Treating them as two
    // made a resource visible to a team and 403 on delete.
    expect(serviceOwnedTypes(map, ['Group:default/Checkout'])).toEqual([
      'git-resource',
    ]);
  });

  it('matches a short-form group ref', () => {
    expect(serviceOwnedTypes(map, ['checkout'])).toEqual(['git-resource']);
  });

  it('matches a template written with a short-form owner', () => {
    // The idiomatic Template owner. Compared raw, this service-owned nothing
    // and its owners were silently refused on every delete.
    const short = new Map([['git-resource', 'payments']]);
    expect(serviceOwnedTypes(short, ['group:default/payments'])).toEqual([
      'git-resource',
    ]);
  });

  it('does not confuse a user ref with the group of the same name', () => {
    // Normalisation defaults the kind in; it must not erase an explicit one.
    expect(serviceOwnedTypes(map, ['user:default/checkout'])).toEqual([]);
  });
});
