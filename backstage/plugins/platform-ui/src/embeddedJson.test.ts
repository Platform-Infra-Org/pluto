import { containsEmbeddedJson, parseEmbeddedJson } from './embeddedJson';

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

describe('containsEmbeddedJson', () => {
  it('finds a dumped payload nested in an object', () => {
    expect(
      containsEmbeddedJson({ name: 'db', extra: '{"a":1}' }),
    ).toBe(true);
  });

  it('finds one inside an array', () => {
    expect(containsEmbeddedJson({ items: ['plain', '[1,2]'] })).toBe(true);
  });

  it('is false for ordinary params, however nested', () => {
    // Real nested objects are not embedded documents — this is what almost
    // every request actually looks like, and the toggle is hidden for it.
    expect(
      containsEmbeddedJson({
        size: 'small',
        versioning: true,
        tags: ['prod', 'eu'],
        lifecycle: { expireAfterDays: 90 },
      }),
    ).toBe(false);
  });

  it('is false for scalars that merely parse as JSON', () => {
    expect(containsEmbeddedJson({ count: '42', ok: 'true' })).toBe(false);
  });
});
