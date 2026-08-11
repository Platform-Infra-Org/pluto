import dagre from '@dagrejs/dagre';

/** Fixed node box, so dagre and the React Flow node agree. */
export const NODE_W = 180;
export const NODE_H = 44;

type LayoutNode = { id: string };
type LayoutEdge = { source: string; target: string };
type Direction = 'TB' | 'BT' | 'LR' | 'RL';

export function layout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  direction: Direction,
): Array<{ id: string; x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  // rankdir takes 'TB'/'BT'/'LR'/'RL' directly — the same strings as the
  // Direction enum and the URL, so no mapping table is needed.
  g.setGraph({ rankdir: direction, nodesep: 28, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  // dagre gives centres; React Flow positions by the top-left corner. Then
  // normalise so the smallest corner sits at 0,0 — otherwise fitView has to
  // compensate for an arbitrary origin.
  const raw = nodes.map(n => {
    const p = g.node(n.id);
    return { id: n.id, x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 };
  });
  const minX = Math.min(...raw.map(n => n.x));
  const minY = Math.min(...raw.map(n => n.y));
  return raw.map(n => ({ ...n, x: n.x - minX, y: n.y - minY }));
}
