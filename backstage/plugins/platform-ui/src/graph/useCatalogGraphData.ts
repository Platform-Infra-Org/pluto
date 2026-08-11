import { useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { GraphEdge, GraphNode, traverse } from './traverse';

/** What the page needs to draw, plus the states before it can. */
export type CatalogGraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;
  error?: Error;
};

export type CatalogGraphQuery = {
  rootEntityRefs: string[];
  maxDepth: number;
  kinds?: string[];
  relations?: string[];
  unidirectional: boolean;
  mergeRelations: boolean;
  relationPairs: [string, string][];
};

/** Entities the catalog names but has not ingested are simply absent. */
const refsOf = (entity: Entity, relations?: string[]): string[] =>
  (entity.relations ?? [])
    .filter(r => !relations || relations.includes(r.type))
    .map(r => r.targetRef);

/**
 * Fetches exactly the entities the graph needs, then hands them to `traverse`.
 *
 * Layer by layer rather than node by node: a forty-node graph is two or three
 * requests, not forty. The walk stops when a layer adds nothing new, so a
 * cyclic catalog terminates here as well as inside traverse.
 *
 * Every fetch is guarded by a cancelled flag. Filters change fast — dragging
 * the depth control fires a query per keystroke — and without it a slow early
 * response can land after a later one and render a graph nobody asked for.
 */
/**
 * A stable dependency key for a query.
 *
 * Exported so the Infinity case can be tested: JSON.stringify(Infinity) is
 * `null`, which would make an unbounded depth indistinguishable from zero.
 */
export function queryKey(query: CatalogGraphQuery): string {
  return JSON.stringify(query, (_k, v) => (v === Infinity ? 'INFINITY' : v));
}

export function useCatalogGraphData(query: CatalogGraphQuery): CatalogGraphData {
  const catalogApi = useApi(catalogApiRef);
  const [state, setState] = useState<CatalogGraphData>({
    nodes: [],
    edges: [],
    loading: true,
  });

  // The query object is rebuilt on every render, so the effect depends on its
  // CONTENT. Infinity has to be encoded: JSON.stringify turns it into null, and
  // round-tripping the query through JSON therefore silently rewrote an
  // unbounded depth to null — `depth >= null` is true immediately, so the walk
  // stopped after the roots and an infinite-depth graph showed one node.
  const key = queryKey(query);
  // The latest query, read inside the effect so nothing is parsed back out.
  const latest = useRef(query);
  latest.current = query;

  useEffect(() => {
    let cancelled = false;
    const q = latest.current;

    if (q.rootEntityRefs.length === 0) {
      setState({ nodes: [], edges: [], loading: false });
      return undefined;
    }

    (async () => {
      setState(s => ({ ...s, loading: true, error: undefined }));
      try {
        const entities = new Map<string, Entity>();
        let frontier = q.rootEntityRefs;
        // maxDepth counts edges, so depth 0 is the roots alone: fetch the
        // frontier, then expand it at most maxDepth times.
        for (let depth = 0; frontier.length > 0; depth++) {
          const { items } = await catalogApi.getEntitiesByRefs({
            entityRefs: frontier,
          });
          if (cancelled) return;
          frontier.forEach((ref, i) => {
            const entity = items[i];
            if (entity) entities.set(ref, entity);
          });
          if (depth >= q.maxDepth) break;
          const next = new Set<string>();
          for (const ref of frontier) {
            const entity = entities.get(ref);
            if (!entity) continue;
            for (const target of refsOf(entity, q.relations)) {
              if (!entities.has(target)) next.add(target);
            }
          }
          frontier = [...next];
        }
        if (cancelled) return;
        const { nodes, edges } = traverse({
          roots: q.rootEntityRefs,
          entities,
          maxDepth: q.maxDepth,
          kinds: q.kinds,
          relations: q.relations,
          unidirectional: q.unidirectional,
          mergeRelations: q.mergeRelations,
          relationPairs: q.relationPairs,
        });
        setState({ nodes, edges, loading: false });
      } catch (e) {
        if (cancelled) return;
        setState({
          nodes: [],
          edges: [],
          loading: false,
          error: e instanceof Error ? e : new Error(String(e)),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogApi, key]);

  return state;
}
