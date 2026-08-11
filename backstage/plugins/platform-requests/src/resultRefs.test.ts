import { parseResultRefs } from './resultRefs';

describe('parseResultRefs', () => {
  it('returns nothing for an absent or blank value', () => {
    expect(parseResultRefs(undefined)).toEqual([]);
    expect(parseResultRefs('')).toEqual([]);
    expect(parseResultRefs('   ')).toEqual([]);
  });

  it('splits a JSON array into its elements', () => {
    expect(parseResultRefs('["a","b"]')).toEqual(['a', 'b']);
    expect(parseResultRefs('["a"]')).toEqual(['a']);
  });

  it('drops empty and whitespace-only elements, and trims the rest', () => {
    expect(parseResultRefs('[" a ", "", "  ", "b"]')).toEqual(['a', 'b']);
    expect(parseResultRefs('[]')).toEqual([]);
  });

  it('keeps a plain name or a URL as the single ref it is', () => {
    expect(parseResultRefs('my-bucket')).toEqual(['my-bucket']);
    expect(parseResultRefs('https://example.test/thing')).toEqual([
      'https://example.test/thing',
    ]);
  });

  it('treats non-array JSON as one opaque ref rather than spreading it', () => {
    expect(parseResultRefs('{"a":1}')).toEqual(['{"a":1}']);
    expect(parseResultRefs('42')).toEqual(['42']);
  });

  it('never throws on malformed JSON', () => {
    expect(parseResultRefs('["a", ')).toEqual(['["a",']);
  });
});
