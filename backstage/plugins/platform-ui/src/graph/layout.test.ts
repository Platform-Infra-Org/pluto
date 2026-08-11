import { layout, NODE_W, NODE_H } from './layout';

const nodes = [
  { id: 'a', kind: 'Resource', name: 'a', namespace: 'default', depth: 0 },
  { id: 'b', kind: 'Group', name: 'b', namespace: 'default', depth: 1 },
] as any;
const edges = [{ id: 'e', source: 'a', target: 'b', label: 'ownerOf', relations: ['ownerOf'] }];

describe('layout', () => {
  it('places every node exactly once', () => {
    const p = layout(nodes, edges, 'LR');
    expect(p.map(n => n.id).sort()).toEqual(['a', 'b']);
  });

  it('lays LR out along x, and TB along y', () => {
    const lr = Object.fromEntries(layout(nodes, edges, 'LR').map(n => [n.id, n]));
    expect(lr.b.x).toBeGreaterThan(lr.a.x);
    const tb = Object.fromEntries(layout(nodes, edges, 'TB').map(n => [n.id, n]));
    expect(tb.b.y).toBeGreaterThan(tb.a.y);
  });

  it('reverses for RL and BT', () => {
    const rl = Object.fromEntries(layout(nodes, edges, 'RL').map(n => [n.id, n]));
    expect(rl.b.x).toBeLessThan(rl.a.x);
    const bt = Object.fromEntries(layout(nodes, edges, 'BT').map(n => [n.id, n]));
    expect(bt.b.y).toBeLessThan(bt.a.y);
  });

  it('returns top-left corners, not centres', () => {
    // React Flow positions nodes by their top-left; dagre reports centres, and
    // forgetting to convert offsets every node by half its size.
    const p = layout([nodes[0]] as any, [], 'LR');
    expect(p[0].x).toBe(0);
    expect(p[0].y).toBe(0);
  });

  it('survives a node with no edges', () => {
    const p = layout(nodes, [], 'LR');
    expect(p).toHaveLength(2);
    expect(p.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
  });

  it('spaces ranks by at least the shared node box', () => {
    // NODE_W/NODE_H are the contract between dagre and the React Flow node: if
    // they disagree, dagre reserves the wrong space and boxes overlap. Asserted
    // here so the constants cannot drift unnoticed.
    expect(NODE_W).toBeGreaterThan(NODE_H);
    const p = Object.fromEntries(layout(nodes, edges, 'LR').map(n => [n.id, n]));
    expect(p.b.x - p.a.x).toBeGreaterThanOrEqual(NODE_W);
  });

  it('is deterministic', () => {
    // Two runs must agree, or the graph reshuffles on every filter change.
    expect(layout(nodes, edges, 'LR')).toEqual(layout(nodes, edges, 'LR'));
  });
});
