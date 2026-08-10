import { parseEmbeddedJson } from './embeddedJson';

describe('parseEmbeddedJson', () => {
  it('parses a serialised object', () => {
    expect(parseEmbeddedJson('{"region":"eu","tags":{"team":"checkout"}}')).toEqual({
      region: 'eu',
      tags: { team: 'checkout' },
    });
  });

  it('parses a serialised array', () => {
    expect(parseEmbeddedJson('[1,"two",{"three":3}]')).toEqual([1, 'two', { three: 3 }]);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseEmbeddedJson('  {"a":1}\n')).toEqual({ a: 1 });
  });

  it('leaves scalars alone, even though JSON.parse would take them', () => {
    // The string "42" is a string. Rendering it as a number would claim the
    // workflow receives a number, and a string field reaches Argo escaped
    // while an object arrives clean — the difference is the whole point.
    for (const s of ['42', 'true', 'false', 'null', '"already a string"']) {
      expect(parseEmbeddedJson(s)).toBeUndefined();
    }
  });

  it('returns undefined for ordinary strings', () => {
    for (const s of ['', '   ', 'orders-db', 'not json {at all}', '{oops']) {
      expect(parseEmbeddedJson(s)).toBeUndefined();
    }
  });

  it('does not parse strings that merely contain json', () => {
    expect(parseEmbeddedJson('see {"a":1} for details')).toBeUndefined();
  });
});
