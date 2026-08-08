import { mergeResourceEdits } from './mergeResourceEdits';

const ORIGINAL = {
  region: 'eu-west-1',
  versioning: true,
  retentionDays: 30,
  tags: ['prod', 'eu'],
  lifecycle: { expireAfterDays: 90 },
};

describe('mergeResourceEdits', () => {
  it('keeps keys the edit set never mentions', () => {
    const { data, errors } = mergeResourceEdits(ORIGINAL, {
      region: 'us-east-1',
    });
    expect(errors).toEqual({});
    expect(data).toEqual({ ...ORIGINAL, region: 'us-east-1' });
  });

  it('preserves the original type of each edited key', () => {
    const { data, errors } = mergeResourceEdits(ORIGINAL, {
      retentionDays: '7',
      versioning: 'false',
    });
    expect(errors).toEqual({});
    expect(data.retentionDays).toBe(7);
    expect(data.versioning).toBe(false);
  });

  it('parses edited objects and arrays from JSON', () => {
    const { data, errors } = mergeResourceEdits(ORIGINAL, {
      tags: '["prod"]',
      lifecycle: '{"expireAfterDays":1}',
    });
    expect(errors).toEqual({});
    expect(data.tags).toEqual(['prod']);
    expect(data.lifecycle).toEqual({ expireAfterDays: 1 });
  });

  it('reports bad JSON and keeps the original value', () => {
    const { data, errors } = mergeResourceEdits(ORIGINAL, { tags: '[oops' });
    expect(errors.tags).toMatch(/not valid JSON/i);
    expect(data.tags).toEqual(['prod', 'eu']);
  });

  it('reports a non-numeric edit of a numeric field', () => {
    const { data, errors } = mergeResourceEdits(ORIGINAL, {
      retentionDays: 'soon',
    });
    expect(errors.retentionDays).toMatch(/number/i);
    expect(data.retentionDays).toBe(30);
  });

  it('reports a non-boolean edit of a boolean field', () => {
    const { errors } = mergeResourceEdits(ORIGINAL, { versioning: 'yes' });
    expect(errors.versioning).toMatch(/true or false/i);
  });

  it('treats an empty string as a real edit of a string field', () => {
    const { data, errors } = mergeResourceEdits(ORIGINAL, { region: '' });
    expect(errors).toEqual({});
    expect(data.region).toBe('');
  });

  it('adds a key that is not in the original as a string', () => {
    const { data } = mergeResourceEdits(ORIGINAL, { note: 'hello' });
    expect(data.note).toBe('hello');
  });

  it('does not mutate the original', () => {
    const copy = JSON.parse(JSON.stringify(ORIGINAL));
    mergeResourceEdits(ORIGINAL, { region: 'x', tags: '[]' });
    expect(ORIGINAL).toEqual(copy);
  });
});
