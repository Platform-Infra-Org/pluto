import { Position } from '@xyflow/react';
import { dedupeEdges, handlePositions } from './flow';
import type { GraphEdge } from './traverse';

const edge = (
  source: string,
  target: string,
  label: string,
  relations = [label],
): GraphEdge => ({ id: `${source}->${target}:${label}`, source, target, label, relations });

describe('handlePositions', () => {
  it('puts the handles on the sides for a horizontal layout', () => {
    // React Flow's default node anchors every edge top-to-bottom. Left to
    // right, that sends each line out of the bottom of one box and into the
    // top of the next, so edges loop around the nodes rather than between them.
    expect(handlePositions('LR')).toEqual({
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
    expect(handlePositions('RL')).toEqual({
      sourcePosition: Position.Left,
      targetPosition: Position.Right,
    });
  });

  it('puts them top and bottom for a vertical layout', () => {
    expect(handlePositions('TB')).toEqual({
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
    expect(handlePositions('BT')).toEqual({
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
    });
  });

  it('falls back to left-to-right for anything unrecognised', () => {
    expect(handlePositions('SIDEWAYS' as never).sourcePosition).toBe(Position.Right);
  });
});

describe('dedupeEdges', () => {
  it('draws one edge per pair of nodes', () => {
    const out = dedupeEdges([edge('a', 'b', 'ownedBy'), edge('b', 'a', 'ownerOf')]);
    expect(out).toHaveLength(1);
  });

  it('keeps both relation names on the surviving edge', () => {
    const out = dedupeEdges([edge('a', 'b', 'ownedBy'), edge('b', 'a', 'ownerOf')]);
    expect(out[0].label).toBe('ownedBy / ownerOf');
    expect(out[0].relations.sort()).toEqual(['ownedBy', 'ownerOf']);
  });

  it('does not repeat a name already shown', () => {
    // A merged edge already reads "a / b"; folding its twin in must not make
    // it "a / b / a / b".
    const merged = edge('a', 'b', 'ownerOf / ownedBy', ['ownerOf', 'ownedBy']);
    const out = dedupeEdges([merged, edge('b', 'a', 'ownerOf')]);
    expect(out[0].label).toBe('ownerOf / ownedBy');
  });

  it('leaves separate pairs alone', () => {
    const out = dedupeEdges([edge('a', 'b', 'x'), edge('b', 'c', 'y')]);
    expect(out).toHaveLength(2);
  });

  it('keeps the first direction seen, which is the one nearer the root', () => {
    const out = dedupeEdges([edge('a', 'b', 'ownedBy'), edge('b', 'a', 'ownerOf')]);
    expect([out[0].source, out[0].target]).toEqual(['a', 'b']);
  });

  it('returns an empty list unchanged', () => {
    expect(dedupeEdges([])).toEqual([]);
  });
});
