import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@internal/plugin-platform-ui';

const NODE = 130;
const ROW = 88;

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
    const midY = ((targets.length - 1) * ROW) / 2;

    const n: Node[] = [
      {
        id: centerRef,
        position: { x: 0, y: midY },
        data: {
          label: `${entity.metadata.name}\n${entity.spec?.type ?? entity.kind}`,
        },
        style: centerNode,
      },
    ];
    const e: Edge[] = [];
    targets.forEach((ref, i) => {
      const parsed = parseEntityRef(ref);
      n.push({
        id: ref,
        position: { x: 300, y: i * ROW },
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
    return { nodes: n, edges: e };
  }, [entity]);

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
      <CardHeader title="Relations" />
      <CardBody>
        {edges.length === 0 ? (
          <div className="sc-muted">No relations.</div>
        ) : (
          <div style={{ height: 300, background: '#0a0a10', borderRadius: 10 }}>
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
