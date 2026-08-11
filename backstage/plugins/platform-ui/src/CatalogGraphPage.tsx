import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { parseEntityRef } from '@backstage/catalog-model';
import { ALL_RELATION_PAIRS } from '@backstage/plugin-catalog-graph';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import { useRouteRef } from '@backstage/core-plugin-api';
import { Card, CardBody, Page, PageHeader } from './components';
import { STARFIELD, STAR_WIDE } from './starfield';
import { layout, NODE_H, NODE_W } from './graph/layout';
import { dedupeEdges, handlePositions } from './graph/flow';
import { parseGraphQuery, toGraphQuery } from './graph/graphUrlState';
import { useCatalogGraphData } from './graph/useCatalogGraphData';
import { GraphFilters } from './GraphFilters';

/** Edge style names map straight onto React Flow's own edge types. */
const EDGE_TYPE = {
  bezier: 'default',
  smoothstep: 'smoothstep',
  step: 'step',
  straight: 'straight',
} as const;

/**
 * The catalog relations graph, drawn with React Flow.
 *
 * Replaces Backstage's built-in SVG graph, which had three defects that could
 * not be fixed from outside it: it cannot pan at the default zoom (its d3 zoom
 * clamps the transform to 0,0 at scale 1), its background cannot line up with
 * the nodes (a CSS background in screen pixels against a scaling viewBox), and
 * it puts its `focused` marker on the label rather than the node, so the rooted
 * node is indistinguishable from its children — which made clicking one look
 * like it did nothing at all.
 *
 * Every capability of the built-in page is kept, and the URL contract with it:
 * see graphUrlState.ts. Only `curve` changed meaning, deliberately.
 */
export function CatalogGraphPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const entityRoute = useRouteRef(entityRouteRef);
  const state = useMemo(
    () => parseGraphQuery(location.search),
    [location.search],
  );

  const { nodes: gNodes, edges: gEdges, loading, error } = useCatalogGraphData({
    rootEntityRefs: state.rootEntityRefs,
    maxDepth: state.maxDepth,
    kinds: state.selectedKinds.length ? state.selectedKinds : undefined,
    relations: state.selectedRelations.length
      ? state.selectedRelations
      : undefined,
    unidirectional: state.unidirectional,
    mergeRelations: state.mergeRelations,
    relationPairs: ALL_RELATION_PAIRS as [string, string][],
  });

  const patch = useCallback(
    (next: Partial<typeof state>) =>
      navigate(toGraphQuery({ ...state, ...next }), { replace: false }),
    [navigate, state],
  );

  const positioned = useMemo(() => {
    if (!gNodes.length) return { nodes: [] as Node[], edges: [] as Edge[] };
    const pos = new Map(
      layout(gNodes, gEdges, state.direction).map(p => [p.id, p]),
    );
    const roots = new Set(state.rootEntityRefs);
    // Handles follow the layout direction: with React Flow's defaults every
    // edge leaves the bottom and enters the top, so a left-to-right graph has
    // its lines looping around the boxes instead of running between them.
    const handles = handlePositions(state.direction);
    const nodes: Node[] = gNodes.map(n => ({
      id: n.id,
      position: pos.get(n.id) ?? { x: 0, y: 0 },
      data: { label: n.title ?? n.name },
      // The rooted node has to be visibly different, or re-rooting looks like
      // nothing happened — the exact defect the built-in graph had.
      className: roots.has(n.id) ? 'sc-graph-node root' : 'sc-graph-node',
      style: { width: NODE_W, height: NODE_H },
      connectable: false,
      ...handles,
    }));
    // One line per pair of nodes. A reciprocal pair drew two lines taking
    // different routes around the boxes, which reads as a tangle rather than a
    // relationship.
    const edges: Edge[] = dedupeEdges(gEdges).map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: EDGE_TYPE[state.curve],
    }));
    return { nodes, edges };
  }, [gNodes, gEdges, state.direction, state.curve, state.rootEntityRefs]);

  // Click re-roots; shift-click opens the entity, matching the built-in page.
  const onNodeClick: NodeMouseHandler = (event, node) => {
    if (event.shiftKey) {
      try {
        const { kind, namespace, name } = parseEntityRef(node.id);
        navigate(entityRoute({ kind, namespace, name }));
      } catch {
        /* ignore an unparseable ref */
      }
      return;
    }
    patch({ rootEntityRefs: [node.id] });
  };

  const availableKinds = useMemo(
    () => [...new Set(gNodes.map(n => n.kind.toLocaleLowerCase('en-US')))].sort(),
    [gNodes],
  );

  return (
    <Page>
      <PageHeader
        title="Catalog graph"
        subtitle={state.rootEntityRefs.join(', ') || undefined}
      />
      <div className="sc-graph-layout">
        <Card>
          <CardBody>
            <GraphFilters
              maxDepth={state.maxDepth}
              kinds={state.selectedKinds}
              relations={state.selectedRelations}
              direction={state.direction}
              curve={state.curve}
              unidirectional={state.unidirectional}
              mergeRelations={state.mergeRelations}
              availableKinds={availableKinds}
              availableRelations={ALL_RELATION_PAIRS.flat()}
              onChange={next =>
                patch({
                  maxDepth: next.maxDepth,
                  selectedKinds: next.kinds,
                  selectedRelations: next.relations,
                  direction: next.direction,
                  curve: next.curve,
                  unidirectional: next.unidirectional,
                  mergeRelations: next.mergeRelations,
                } as Partial<typeof state>)
              }
            />
          </CardBody>
        </Card>

        {/* A definite height, not minHeight: React Flow measures its container on
            mount, and with an indefinite height it initialises at zero — nodes
            still render (they are absolutely positioned) but nothing is
            interactive, so clicks and panning silently do nothing. */}
        <div className="sc-graph-canvas" style={{ height: 620 }}>
          {placeholder({
            rooted: state.rootEntityRefs.length > 0,
            error,
            loading,
            nodeCount: positioned.nodes.length,
          }) ?? (
            <ReactFlow
              nodes={positioned.nodes}
              edges={positioned.edges}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              onNodeClick={onNodeClick}
              proOptions={{ hideAttribution: true }}
            >
              {/* Two layers at different spacings, inside the transform, so the
                  field pans and zooms with the nodes — which is precisely what
                  the SVG graph could not do. */}
              <Background
                id="stars-dim"
                variant={BackgroundVariant.Dots}
                gap={STARFIELD.gap}
                size={STARFIELD.dimSize}
                color={STARFIELD.starDim}
              />
              <Background
                id="stars-bright"
                variant={BackgroundVariant.Dots}
                gap={STAR_WIDE}
                size={STARFIELD.size}
                color={STARFIELD.star}
              />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>
      </div>
    </Page>
  );
}

/** A sentence beats a blank canvas — the built-in page showed neither. */
function Empty({ text }: { text: string }) {
  return <div className="sc-graph-empty">{text}</div>;
}

/**
 * What the canvas shows instead of the graph, or undefined to show the graph.
 * Order matters: an error while unrooted is still "pick an entity", and the
 * loading line only stands in for a canvas that has nothing on it yet.
 */
function placeholder(s: {
  rooted: boolean;
  error?: Error;
  loading: boolean;
  nodeCount: number;
}) {
  if (!s.rooted)
    return (
      <Empty text="Pick an entity to root the graph on — open one from the catalog and use Explore graph." />
    );
  if (s.error)
    return <Empty text={`Could not load the graph: ${s.error.message}`} />;
  if (s.loading && s.nodeCount === 0) return <Empty text="Loading…" />;
  if (s.nodeCount === 0)
    return <Empty text="Nothing is related to this entity." />;
  return undefined;
}
