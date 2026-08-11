import { nodeLabel } from './nodeLabel';

describe('nodeLabel', () => {
  it('drops a loop payload but keeps the index', () => {
    expect(nodeLabel('provision(0:{"name":"bucket-a"})')).toBe('provision [0]');
    expect(nodeLabel('provision(11:{"name":"b"})')).toBe('provision [11]');
  });

  it('consumes a payload containing its own parentheses', () => {
    expect(nodeLabel('provision(2:{"cidr":"(10.0.0.0/8)"})')).toBe(
      'provision [2]',
    );
  });

  it('keeps parentheses that are part of the step name', () => {
    expect(nodeLabel('deploy (canary)')).toBe('deploy (canary)');
    expect(nodeLabel('deploy (canary)(3:{"a":1})')).toBe('deploy (canary) [3]');
  });

  it('leaves a name that already fits alone', () => {
    expect(nodeLabel('provision-db')).toBe('provision-db');
  });

  it('truncates a very long name to the budget', () => {
    const out = nodeLabel('x'.repeat(400));
    expect(out).toHaveLength(28);
    expect(out.endsWith('…')).toBe(true);
  });

  it('never cuts a surrogate pair in half', () => {
    // The pair straddles the cut, so the emoji is dropped whole.
    const out = nodeLabel(`${'x'.repeat(26)}🚀tail`);
    expect(out).toBe(`${'x'.repeat(26)}…`);
  });

  it('returns empty only for empty input', () => {
    expect(nodeLabel('')).toBe('');
    expect(nodeLabel('(0:{"a":1})')).toBe('[0]');
  });
});
