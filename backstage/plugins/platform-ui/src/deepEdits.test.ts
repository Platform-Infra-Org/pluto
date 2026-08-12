import { leavesOf, mergeDeepEdits, pathKey } from './deepEdits';

const DOC = {
  size: 'large',
  retentionDays: 30,
  enabled: true,
  owner: null,
  network: { vpc: 'vpc-1', subnets: ['a', 'b'], tuning: { mtu: 1500 } },
  tags: ['prod', 'pci'],
};

describe('leavesOf', () => {
  it('reaches every scalar at every depth, in document order', () => {
    expect(leavesOf(DOC).map(l => l.path)).toEqual([
      ['size'],
      ['retentionDays'],
      ['enabled'],
      ['owner'],
      ['network', 'vpc'],
      ['network', 'subnets', 0],
      ['network', 'subnets', 1],
      ['network', 'tuning', 'mtu'],
      ['tags', 0],
      ['tags', 1],
    ]);
  });

  it('records the original type, and shows null as an empty field', () => {
    const byKey = Object.fromEntries(leavesOf(DOC).map(l => [pathKey(l.path), l]));
    expect(byKey['["retentionDays"]'].type).toBe('number');
    expect(byKey['["enabled"]'].type).toBe('boolean');
    expect(byKey['["owner"]']).toMatchObject({ type: 'null', value: '' });
    expect(byKey['["network","tuning","mtu"]'].value).toBe('1500');
  });

  it('does not descend into an empty container, and yields no leaf for it', () => {
    expect(leavesOf({ a: {}, b: [] })).toEqual([]);
  });
});

describe('mergeDeepEdits', () => {
  const leaves = leavesOf(DOC);
  const merge = (edits: Record<string, string>) =>
    mergeDeepEdits(DOC, leaves, edits);

  it('edits a deeply nested value without touching anything else', () => {
    const { data, errors } = merge({ '["network","tuning","mtu"]': '9000' });
    expect(errors).toEqual({});
    expect(data).toEqual({ ...DOC, network: { ...DOC.network, tuning: { mtu: 9000 } } });
  });

  it('edits inside an array by index', () => {
    const { data } = merge({ '["tags",1]': 'internal' });
    expect(data.tags).toEqual(['prod', 'internal']);
  });

  it('keeps the original types rather than stringifying them', () => {
    const { data } = merge({
      '["retentionDays"]': '90',
      '["enabled"]': 'false',
    });
    expect(data.retentionDays).toBe(90);
    expect(data.enabled).toBe(false);
  });

  it('rejects a non-number for a number and a non-boolean for a boolean', () => {
    const { data, errors } = merge({
      '["retentionDays"]': 'soon',
      '["enabled"]': 'yes',
    });
    expect(errors['["retentionDays"]']).toMatch(/number/);
    expect(errors['["enabled"]']).toMatch(/true or false/);
    // The document still comes back whole and unchanged on those keys.
    expect(data.retentionDays).toBe(30);
    expect(data.enabled).toBe(true);
  });

  it('leaves a null null while its field is empty, and sets a string once typed', () => {
    expect(merge({ '["owner"]': '' }).data.owner).toBeNull();
    expect(merge({ '["owner"]': 'team-a' }).data.owner).toBe('team-a');
  });

  it('carries through every key the form did not edit', () => {
    const { data } = merge({ '["size"]': 'small' });
    expect(data).toEqual({ ...DOC, size: 'small' });
  });

  it('does not mutate the original document', () => {
    const before = JSON.stringify(DOC);
    merge({ '["network","vpc"]': 'vpc-9', '["tags",0]': 'x' });
    expect(JSON.stringify(DOC)).toBe(before);
  });

  it('keeps a dotted key unambiguous', () => {
    const doc = { 'app.kubernetes.io/name': 'web', app: { kubernetes: 'no' } };
    const ls = leavesOf(doc);
    const { data } = mergeDeepEdits(doc, ls, {
      '["app.kubernetes.io/name"]': 'api',
    });
    expect(data['app.kubernetes.io/name']).toBe('api');
    expect(data.app).toEqual({ kubernetes: 'no' });
  });
});
