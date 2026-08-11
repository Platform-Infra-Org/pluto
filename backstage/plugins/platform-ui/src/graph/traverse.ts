import type { Entity } from '@backstage/catalog-model';

export type GraphNode = {
  id: string;
  kind: string;
  name: string;
  namespace: string;
  title?: string;
  depth: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  relations: string[];
};

export type TraverseOptions = {
  roots: string[]; // entity refs
  entities: Map<string, Entity>;
  maxDepth: number; // Infinity allowed
  kinds?: string[]; // lowercase kind names; undefined = all
  relations?: string[]; // undefined = all
  unidirectional: boolean;
  mergeRelations: boolean;
  relationPairs: [string, string][];
};

type RawEdge = { source: string; target: string; label: string; relations: string[] };

function toGraphNode(ref: string, entity: Entity, depth: number): GraphNode {
  return {
    id: ref,
    kind: entity.kind,
    name: entity.metadata.name,
    namespace: entity.metadata.namespace ?? 'default',
    title: (entity.metadata as { title?: string }).title,
    depth,
  };
}

/** BFS from roots. visited is checked before enqueueing, so cycles terminate. */
function walk(opts: TraverseOptions): { depths: Map<string, number>; edges: RawEdge[] } {
  const { roots, entities, maxDepth } = opts;
  const depths = new Map<string, number>();
  const visited = new Set<string>();
  const edges: RawEdge[] = [];
  const queue: string[] = [];

  for (const root of roots) {
    if (!entities.has(root) || visited.has(root)) continue;
    visited.add(root);
    depths.set(root, 0);
    queue.push(root);
  }

  while (queue.length > 0) {
    const ref = queue.shift()!;
    const depth = depths.get(ref)!;
    if (depth >= maxDepth) continue;

    const entity = entities.get(ref);
    for (const rel of entity?.relations ?? []) {
      const targetRef = (rel as { targetRef: string }).targetRef;
      const type = (rel as { type: string }).type;
      if (!entities.has(targetRef)) continue; // catalog can reference an unfetched entity

      edges.push({ source: ref, target: targetRef, label: type, relations: [type] });

      if (!visited.has(targetRef)) {
        visited.add(targetRef);
        depths.set(targetRef, depth + 1);
        queue.push(targetRef);
      }
    }
  }

  return { depths, edges };
}

/** Collapse a declared [a, b] pair between the same two entities into one 'a / b' edge. */
function mergePairs(edges: RawEdge[], relationPairs: [string, string][]): RawEdge[] {
  const declared = new Map<string, [string, string]>();
  for (const pair of relationPairs) declared.set([...pair].sort().join('|'), pair);

  const used = new Set<number>();
  const out: RawEdge[] = [];

  for (let i = 0; i < edges.length; i++) {
    if (used.has(i)) continue;
    const e = edges[i];
    const j = edges.findIndex(
      (o, idx) =>
        idx > i &&
        !used.has(idx) &&
        o.source === e.target &&
        o.target === e.source &&
        declared.has([e.label, o.label].sort().join('|')),
    );
    if (j === -1) {
      out.push(e);
      continue;
    }
    used.add(i);
    used.add(j);
    const [a, b] = declared.get([e.label, edges[j].label].sort().join('|'))!;
    out.push({ source: e.source, target: e.target, label: `${a} / ${b}`, relations: [a, b] });
  }

  return out;
}

export function traverse(opts: TraverseOptions): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { entities, kinds, relations, unidirectional, mergeRelations, roots } = opts;
  const { depths, edges: walkedEdges } = walk(opts);

  // Relation type filter drops edges only; nodes left unreachable are dropped next.
  let rawEdges = relations ? walkedEdges.filter(e => relations.includes(e.label)) : walkedEdges;

  let outputIds: Set<string>;
  if (relations) {
    // Re-derive reachability from the roots using only the surviving edges
    // (undirected — a relation edge reaches either endpoint).
    outputIds = new Set(roots.filter(r => depths.has(r)));
    const queue = [...outputIds];
    while (queue.length > 0) {
      const ref = queue.shift()!;
      for (const e of rawEdges) {
        let other: string | undefined;
        if (e.source === ref) other = e.target;
        else if (e.target === ref) other = e.source;
        if (other && !outputIds.has(other)) {
          outputIds.add(other);
          queue.push(other);
        }
      }
    }
    rawEdges = rawEdges.filter(e => outputIds.has(e.source) && outputIds.has(e.target));
  } else {
    outputIds = new Set(depths.keys());
  }

  // Kind filter: output only — the walk above already used the unfiltered graph.
  const kindSet = kinds ? new Set(kinds.map(k => k.toLowerCase())) : undefined;
  const nodes: GraphNode[] = [];
  for (const id of outputIds) {
    const entity = entities.get(id);
    if (!entity) continue;
    if (kindSet && !kindSet.has(entity.kind.toLowerCase())) continue;
    nodes.push(toGraphNode(id, entity, depths.get(id)!));
  }
  const nodeIds = new Set(nodes.map(n => n.id));
  rawEdges = rawEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  const merged = mergeRelations ? mergePairs(rawEdges, opts.relationPairs) : rawEdges;

  let edges: GraphEdge[] = merged.map(e => ({
    id: `${e.source}->${e.target}:${e.label}`,
    source: e.source,
    target: e.target,
    label: e.label,
    relations: e.relations,
  }));

  if (unidirectional) {
    const seen = new Set<string>();
    edges = edges.filter(e => {
      const key = [e.source, e.target].sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return { nodes, edges };
}
