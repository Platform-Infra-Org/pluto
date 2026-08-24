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

  it('compares refs exactly, as every other admin check does', () => {
    expect(serviceOwnedTypes(map, ['group:default/Checkout'])).toEqual([]);
  });
});
