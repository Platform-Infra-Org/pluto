import { parseGraphQuery, toGraphQuery, EMPTY } from './graphUrlState';

describe('graph url state', () => {
  it('reads the bracket array form Backstage writes', () => {
    const s = parseGraphQuery('?rootEntityRefs[]=resource:default/a&maxDepth=2');
    expect(s.rootEntityRefs).toEqual(['resource:default/a']);
    expect(s.maxDepth).toBe(2);
  });

  it('ignores a scalar rootEntityRefs, exactly as the built-in page does', () => {
    // Backstage requires Array.isArray here; a scalar silently yields no root
    // and an empty canvas. Matching that keeps old links behaving identically.
    expect(parseGraphQuery('?rootEntityRefs=resource:default/a').rootEntityRefs).toEqual([]);
  });

  it('round-trips the infinity symbol', () => {
    expect(parseGraphQuery('?maxDepth=%E2%88%9E').maxDepth).toBe(Infinity);
    expect(toGraphQuery({ ...EMPTY, maxDepth: Infinity })).toContain('maxDepth=%E2%88%9E');
  });

  it('defaults to infinite depth when absent', () => {
    expect(parseGraphQuery('').maxDepth).toBe(Infinity);
  });

  it('parses the booleans and the enums', () => {
    const s = parseGraphQuery('?unidirectional=true&mergeRelations=false&direction=LR&curve=curveMonotoneX');
    expect(s.unidirectional).toBe(true);
    expect(s.mergeRelations).toBe(false);
    expect(s.direction).toBe('LR');
  });

  it('rejects a direction it does not know', () => {
    expect(parseGraphQuery('?direction=SIDEWAYS').direction).toBe('LR');
  });

  it('round-trips a full state', () => {
    const s = parseGraphQuery(
      '?rootEntityRefs[]=resource:default/a&selectedKinds[]=resource&selectedRelations[]=ownerOf' +
      '&maxDepth=3&unidirectional=true&mergeRelations=true&direction=TB&showFilters=true',
    );
    expect(parseGraphQuery(toGraphQuery(s))).toEqual(s);
  });
});
