import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  GraphDirectionPicker,
  handlePositions,
  layout,
  STARFIELD,
  STAR_WIDE,
  useGraphDirection,
  type Direction,
} from '@internal/plugin-platform-ui';
import { Typography } from '@material-ui/core';
import { requestsApiRef, WorkflowInfo, WorkflowNode } from '../api';

const PHASE_COLOR: Record<string, string> = {
  Succeeded: 'hsl(var(--sc-success))',
  /* Not an Argo phase — see displayPhase. Yellow, matching the request badge. */
  Suspended: 'hsl(var(--sc-warning))',
  Running: 'hsl(var(--sc-primary))',
  Pending: 'hsl(var(--sc-muted-fg))',
  Failed: 'hsl(var(--sc-destructive))',
  Error: 'hsl(var(--sc-destructive))',
  Skipped: 'hsl(var(--sc-muted-fg))',
};

/**
 * The phase to show, which is not always the phase Argo reports.
 *
 * Argo has no Suspended phase: a suspend step that is waiting reports
 * `type: 'Suspend'` with `phase: 'Running'` — identical to a container step
 * that is busy. Colouring by phase alone paints the one node that needs a human
 * the same as every node that needs nothing.
 */
export function displayPhase(n: WorkflowNode): string | undefined {
  return n.type === 'Suspend' && n.phase === 'Running' ? 'Suspended' : n.phase;
}

function toFlow(
  wf: WorkflowInfo,
  direction: Direction,
): { nodes: Node[]; edges: Edge[] } {
  const edges: Edge[] = wf.nodes.flatMap(n =>
    n.children
      .filter(c => wf.nodes.some(m => m.id === c))
      .map(c => ({ id: `${n.id}->${c}`, source: n.id, target: c, animated: true })),
  );
  const pos = new Map(layout(wf.nodes, edges, direction).map(p => [p.id, p]));
  // Handles follow the layout direction: with React Flow's defaults every
  // edge leaves the bottom and enters the top, so a left-to-right graph has
  // its lines looping around the boxes instead of running between them.
  const handles = handlePositions(direction);
  const nodes: Node[] = wf.nodes.map(n => {
    const phase = displayPhase(n);
    return {
      id: n.id,
      position: pos.get(n.id) ?? { x: 0, y: 0 },
      data: { label: `${n.name}\n${phase ?? ''}` },
      style: {
        // A waiting step is the one thing on this canvas someone must act on,
        // so it gets a thicker edge as well as the colour.
        border: `${phase === 'Suspended' ? 3 : 1.5}px solid ${
          PHASE_COLOR[phase ?? 'Pending'] ?? 'hsl(var(--sc-muted-fg))'
        }`,
        background: '#17171f',
        color: '#e7e7ef',
        borderRadius: 8,
        padding: '5px 8px',
        fontSize: 10,
        lineHeight: 1.3,
        whiteSpace: 'pre-line',
        width: 128,
      },
      ...handles,
    };
  });
  return { nodes, edges };
}

export function WorkflowGraph({ id, live }: { id: number; live: boolean }) {
  const api = useApi(requestsApiRef);
  const [wf, setWf] = useState<WorkflowInfo>();
  const [direction, setDirection] = useGraphDirection('platform-workflow-dir', 'LR');

  useEffect(() => {
    let stop = false;
    const tick = () =>
      api.getWorkflow(id).then(w => {
        if (!stop) setWf(w);
      });
    tick();
    if (!live) return undefined;
    const t = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [api, id, live]);

  if (!wf || wf.nodes.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        {wf ? 'No workflow nodes yet.' : 'Loading…'}
      </Typography>
    );
  }
  const { nodes, edges } = toFlow(wf, direction);
  return (
    <>
      <div className="sc-row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
        <GraphDirectionPicker
          value={direction}
          onChange={setDirection}
          id="workflow-dir"
        />
      </div>
      <div className="sc-graph-canvas" style={{ height: 300 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.25 }}
          minZoom={0.4}
          maxZoom={1.25}
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
    </>
  );
}
