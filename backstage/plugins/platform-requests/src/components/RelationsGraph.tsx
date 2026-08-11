import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import {
  entityRouteRef,
  useEntity,
} from '@backstage/plugin-catalog-react';
import { useRouteRef } from '@backstage/core-plugin-api';
import {
  Card,
  CardHeader,
  CardBody,
  STARFIELD,
  STAR_WIDE,
  GraphDirectionPicker,
  useGraphDirection,
  layout,
  handlePositions,
} from '@internal/plugin-platform-ui';

const NODE = 130;

const baseNode = {
  background: '#17171f',
  color: '#e7e7ef',
  border: '1.5px solid #32303e',
  borderRadius: 8,
  padding: '5px 9px',
  fontSize: 10,
  lineHeight: 1.3,
  width: NODE,
  whiteSpace: 'pre-line' as const,
  textAlign: 'center' as const,
};
const centerNode = {
  ...baseNode,
  border: '1.5px solid hsl(var(--sc-primary))',
  background: 'hsl(var(--sc-primary) / .18)',
};

/**
 * A shadcn React Flow relations graph for an entity: the entity in the centre
 * (accent-highlighted) with its catalog relations fanned out; nodes are
 * clickable and navigate to the related entity. Dark dotted canvas, capped
 * zoom, follows the color picker.
 */
export function RelationsGraph() {
  const { entity } = useEntity();
  const navigate = useNavigate();
  const entityRoute = useRouteRef(entityRouteRef);
  const [direction, setDirection] = useGraphDirection(
    'platform-relations-dir',
    'LR',
  );

  const { nodes, edges } = useMemo(() => {
    const centerRef = stringifyEntityRef(entity).toLowerCase();
    // Dedupe related targets, keep the relation types per target.
    const byTarget = new Map<string, Set<string>>();
    for (const r of entity.relations ?? []) {
      const ref = r.targetRef.toLowerCase();
      if (!byTarget.has(ref)) byTarget.set(ref, new Set());
      byTarget.get(ref)!.add(r.type);
    }
    const targets = [...byTarget.keys()];

    const n: Node[] = [
      {
        id: centerRef,
        position: { x: 0, y: 0 },
        data: {
          label: `${entity.metadata.name}\n${entity.spec?.type ?? entity.kind}`,
        },
        style: centerNode,
      },
    ];
    const e: Edge[] = [];
    targets.forEach(ref => {
      const parsed = parseEntityRef(ref);
      n.push({
        id: ref,
        position: { x: 0, y: 0 },
        data: { label: `${parsed.name}\n${parsed.kind}` },
        style: baseNode,
      });
      e.push({
        id: `${centerRef}->${ref}`,
        source: centerRef,
        target: ref,
        label: [...byTarget.get(ref)!].join(', '),
        labelStyle: { fill: '#c9c9d4', fontSize: 10 },
        labelBgStyle: { fill: '#0a0a10' },
        style: { stroke: 'rgba(255,255,255,.28)' },
      });
    });
    // Handles follow the layout direction: React Flow's default anchors every
    // edge to the top and bottom, so a left-to-right layout has its lines
    // looping around the boxes instead of running between them.
    const pos = new Map(layout(n, e, direction).map(p => [p.id, p]));
    const handles = handlePositions(direction);
    const positioned = n.map(node => ({
      ...node,
      position: pos.get(node.id) ?? node.position,
      ...handles,
    }));
    return { nodes: positioned, edges: e };
  }, [entity, direction]);

  const onNodeClick = (_: unknown, node: Node) => {
    try {
      const { kind, namespace, name } = parseEntityRef(node.id);
      navigate(entityRoute({ kind, namespace, name }));
    } catch {
      /* ignore */
    }
  };

  return (
    <Card>
      <CardHeader
        title="Relations"
        action={
          <div className="sc-row">
            <GraphDirectionPicker
              value={direction}
              onChange={setDirection}
              id="relations-dir"
            />
            {/* Depth is explicit: this link asks for two hops rather than
                inheriting whatever the graph page happens to default to. */}
            <Link
              to={`/catalog-graph?rootEntityRefs[]=${encodeURIComponent(
                stringifyEntityRef(entity),
              )}&maxDepth=2`}
              className="sc-btn sc-btn-outline sc-btn-sm sc-btn-accent"
              title="Open the full relations graph, rooted on this entity"
            >
              Explore graph
            </Link>
          </div>
        }
      />
      <CardBody>
        {edges.length === 0 ? (
          <div className="sc-muted">No relations.</div>
        ) : (
          <div className="sc-graph-canvas" style={{ height: 300 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              fitViewOptions={{ maxZoom: 1, padding: 0.25 }}
              minZoom={0.4}
              maxZoom={1.25}
              nodesConnectable={false}
              onNodeClick={onNodeClick}
              proOptions={{ hideAttribution: true }}
            >
              {/* Two layers at different spacings: one grid of identical dots reads as
                  graph paper, and at equal spacing the layers moire into a single grid.
                  Both pan and zoom with the canvas, which a CSS background would not.
                  Distinct ids are required — without them React Flow reuses one SVG
                  pattern and only the last layer renders. */}
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
          </div>
        )}
      </CardBody>
    </Card>
  );
}
