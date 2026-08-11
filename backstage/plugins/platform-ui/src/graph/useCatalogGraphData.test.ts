import { queryKey, type CatalogGraphQuery } from './useCatalogGraphData';

const base: CatalogGraphQuery = {
  rootEntityRefs: ['resource:default/a'],
  maxDepth: Infinity,
  unidirectional: false,
  mergeRelations: false,
  relationPairs: [['ownerOf', 'ownedBy']],
};

describe('queryKey', () => {
  it('keeps an unbounded depth distinguishable from zero', () => {
    // JSON.stringify(Infinity) is `null`. Round-tripping the query through JSON
    // therefore rewrote an unbounded depth to null, `depth >= null` was true on
    // the first pass, and an infinite-depth graph rendered exactly one node.
    expect(queryKey(base)).not.toBe(queryKey({ ...base, maxDepth: 0 }));
    expect(queryKey(base)).toContain('INFINITY');
    expect(queryKey(base)).not.toContain('null');
  });

  it('is stable for an unchanged query', () => {
    // The key is an effect dependency: if it varied between identical queries
    // the graph would refetch on every render.
    expect(queryKey(base)).toBe(queryKey({ ...base }));
  });

  it('changes when any filter changes', () => {
    const k = queryKey(base);
    expect(queryKey({ ...base, maxDepth: 3 })).not.toBe(k);
    expect(queryKey({ ...base, unidirectional: true })).not.toBe(k);
    expect(queryKey({ ...base, mergeRelations: true })).not.toBe(k);
    expect(queryKey({ ...base, kinds: ['resource'] })).not.toBe(k);
    expect(queryKey({ ...base, relations: ['ownerOf'] })).not.toBe(k);
    expect(queryKey({ ...base, rootEntityRefs: ['group:default/b'] })).not.toBe(k);
  });
});
