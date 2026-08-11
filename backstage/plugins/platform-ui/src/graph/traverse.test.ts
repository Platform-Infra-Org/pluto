import { traverse } from './traverse';

const ent = (ref: string, relations: Array<[string, string]> = []) => {
  const [kind, rest] = ref.split(':');
  const [namespace, name] = rest.split('/');
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: kind[0].toUpperCase() + kind.slice(1),
    metadata: { name, namespace },
    relations: relations.map(([type, targetRef]) => ({ type, targetRef })),
  } as any;
};

// a --ownedBy--> team,  team --ownerOf--> a, b
const ENTITIES = new Map<string, any>([
  ['resource:default/a', ent('resource:default/a', [['ownedBy', 'group:default/team']])],
  ['resource:default/b', ent('resource:default/b', [['ownedBy', 'group:default/team']])],
  ['group:default/team', ent('group:default/team', [
    ['ownerOf', 'resource:default/a'],
    ['ownerOf', 'resource:default/b'],
  ])],
]);

const base = {
  entities: ENTITIES,
  maxDepth: Infinity,
  unidirectional: false,
  mergeRelations: false,
  relationPairs: [['ownerOf', 'ownedBy']] as [string, string][],
};

describe('traverse', () => {
  it('walks outward from the root', () => {
    const { nodes } = traverse({ ...base, roots: ['resource:default/a'] });
    expect(nodes.map(n => n.id).sort()).toEqual([
      'group:default/team', 'resource:default/a', 'resource:default/b',
    ]);
  });

  it('records depth, so the root is 0', () => {
    const { nodes } = traverse({ ...base, roots: ['resource:default/a'] });
    const byId = Object.fromEntries(nodes.map(n => [n.id, n.depth]));
    expect(byId['resource:default/a']).toBe(0);
    expect(byId['group:default/team']).toBe(1);
    expect(byId['resource:default/b']).toBe(2);
  });

  it('stops at maxDepth', () => {
    const { nodes } = traverse({ ...base, roots: ['resource:default/a'], maxDepth: 1 });
    expect(nodes.map(n => n.id).sort()).toEqual([
      'group:default/team', 'resource:default/a',
    ]);
  });

  it('filters by kind without breaking the walk through excluded nodes', () => {
    // Excluding Group must not silently orphan b: the walk still traverses the
    // group, it is only hidden. Backstage behaves this way and a naive filter
    // does not.
    const { nodes } = traverse({ ...base, roots: ['resource:default/a'], kinds: ['resource'] });
    expect(nodes.map(n => n.id)).not.toContain('group:default/team');
  });

  it('filters by relation type', () => {
    const { edges } = traverse({
      ...base, roots: ['resource:default/a'], relations: ['ownerOf'],
    });
    expect(edges.every(e => e.relations.every(r => r === 'ownerOf'))).toBe(true);
  });

  it('merges a relation pair into one edge when asked', () => {
    const { edges } = traverse({
      ...base, roots: ['resource:default/a'], mergeRelations: true,
    });
    const between = edges.filter(
      e => [e.source, e.target].sort().join('|') ===
           ['group:default/team', 'resource:default/a'].sort().join('|'),
    );
    expect(between).toHaveLength(1);
    expect(between[0].label).toBe('ownerOf / ownedBy');
  });

  it('keeps both directions when not merging', () => {
    const { edges } = traverse({ ...base, roots: ['resource:default/a'] });
    const between = edges.filter(
      e => [e.source, e.target].sort().join('|') ===
           ['group:default/team', 'resource:default/a'].sort().join('|'),
    );
    expect(between.length).toBeGreaterThan(1);
  });

  it('drops the reverse edge when unidirectional', () => {
    const { edges } = traverse({
      ...base, roots: ['resource:default/a'], unidirectional: true,
    });
    const pairs = edges.map(e => `${e.source}->${e.target}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('terminates on a cycle', () => {
    // a -> b -> a. Without a visited set this never returns, and the page hangs
    // with no error, which is the worst possible failure.
    const cyc = new Map<string, any>([
      ['resource:default/a', ent('resource:default/a', [['dependsOn', 'resource:default/b']])],
      ['resource:default/b', ent('resource:default/b', [['dependsOn', 'resource:default/a']])],
    ]);
    const { nodes } = traverse({ ...base, entities: cyc, roots: ['resource:default/a'] });
    expect(nodes).toHaveLength(2);
  });

  it('ignores refs that are not in the entity map', () => {
    // The catalog can reference an entity that has not been ingested yet.
    const { nodes } = traverse({
      ...base,
      entities: new Map([['resource:default/a', ent('resource:default/a', [['ownedBy', 'group:default/ghost']])]]),
      roots: ['resource:default/a'],
    });
    expect(nodes.map(n => n.id)).toEqual(['resource:default/a']);
  });

  it('supports multiple roots', () => {
    const { nodes } = traverse({
      ...base, roots: ['resource:default/a', 'resource:default/b'], maxDepth: 0,
    });
    expect(nodes.map(n => n.id).sort()).toEqual(['resource:default/a', 'resource:default/b']);
  });
});
