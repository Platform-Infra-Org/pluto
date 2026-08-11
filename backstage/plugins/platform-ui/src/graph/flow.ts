import { Position } from '@xyflow/react';
import type { GraphEdge } from './traverse';
import type { Direction } from './graphUrlState';

/**
 * Which sides of a node its edges leave and enter, for a given layout direction.
 *
 * React Flow's default node anchors every edge to the top and bottom handles.
 * With a left-to-right layout that sends each line out of the bottom of one box
 * and into the top of the next, so the edges loop around the nodes instead of
 * running between them. The handles have to follow the direction dagre laid the
 * graph out in.
 */
export function handlePositions(direction: Direction): {
  sourcePosition: Position;
  targetPosition: Position;
} {
  switch (direction) {
    case 'RL':
      return { sourcePosition: Position.Left, targetPosition: Position.Right };
    case 'TB':
      return { sourcePosition: Position.Bottom, targetPosition: Position.Top };
    case 'BT':
      return { sourcePosition: Position.Top, targetPosition: Position.Bottom };
    case 'LR':
    default:
      return { sourcePosition: Position.Right, targetPosition: Position.Left };
  }
}

/**
 * One edge per pair of nodes, however many relations connect them.
 *
 * Two entities are usually joined by a reciprocal pair — ownerOf one way and
 * ownedBy the other — which React Flow draws as two separate lines taking
 * different routes around the boxes. One line carrying both names says the same
 * thing and is legible. The direction of the surviving edge is the first one
 * seen, which is the one nearer the root because the walk is breadth-first.
 */
export function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const byPair = new Map<string, GraphEdge>();
  for (const edge of edges) {
    const key = [edge.source, edge.target].sort().join('|');
    const existing = byPair.get(key);
    if (!existing) {
      byPair.set(key, { ...edge });
      continue;
    }
    // Same pair: fold the label in, without repeating a name already shown.
    const shown = existing.label.split(' / ');
    for (const part of edge.label.split(' / ')) {
      if (!shown.includes(part)) shown.push(part);
    }
    existing.label = shown.join(' / ');
    existing.relations = [
      ...new Set([...existing.relations, ...edge.relations]),
    ];
  }
  return [...byPair.values()];
}
