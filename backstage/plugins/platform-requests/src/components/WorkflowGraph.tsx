import { CSSProperties, useEffect, useState } from 'react';
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
  handlePositions,
  layout,
  NODE_H,
  STARFIELD,
  STAR_WIDE,
  type Direction,
} from '@internal/plugin-platform-ui';
import { Typography } from '@material-ui/core';
import { requestsApiRef, WorkflowInfo, WorkflowNode } from '../api';
import { nodeLabel } from '../nodeLabel';

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

/** One line of a node label: never wraps, ends in an ellipsis at the box edge. */
const LINE: CSSProperties = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

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
      data: {
        // The untruncated name stays reachable on hover: for a loop iteration
        // the payload nodeLabel drops is exactly what tells you *which item*
        // failed.
        // `color: inherit` is load-bearing, not tidiness. The canvas is dark in
        // both themes, and the node below sets its own light text — but that is
        // an *inline* style on the node, which this span only inherits while
        // nothing targets it directly. `.sc, .sc * { color: hsl(var(--sc-fg)) }`
        // targets every descendant, and a direct rule beats inheritance, so in
        // light mode the span took the page's dark text and vanished into the
        // node. Wrapping a plain string in an element is what exposed it.
        label: (
          // Two block lines, each clipped on its own, rather than one string
          // with a newline. A single string wraps when it is wider than the
          // box, so a long name became three lines in a box sized for two and
          // the last one was sliced through the middle. `nowrap` makes each
          // line exactly one line; `ellipsis` ends it at the box edge instead
          // of painting past it.
          <span
            title={n.name}
            style={{ color: 'inherit', display: 'block', width: '100%' }}
          >
            <span style={LINE}>{nodeLabel(n.name)}</span>
            <span style={{ ...LINE, opacity: 0.75 }}>{phase ?? ''}</span>
          </span>
        ),
      },
      style: {
        // A waiting step is the one thing on this canvas someone must act on,
        // so it gets a thicker edge as well as the colour.
        border: `${phase === 'Suspended' ? 3 : 1.5}px solid ${
          PHASE_COLOR[phase ?? 'Pending'] ?? 'hsl(var(--sc-muted-fg))'
        }`,
        background: '#17171f',
        color: '#e7e7ef',
        borderRadius: 8,
        // The box has to hold exactly two lines of 12px text. `styles.ts` sets
        // `.sc *  { font-size: max(12px, 1em) }` as a deliberate legibility
        // floor, so the label renders at 12px however small this asks — the
        // arithmetic that matters is 2 x 12 x 1.2 = 28.8px of text, plus 8px
        // padding and ~3px of border, inside NODE_H (44). It used to be
        // 2 x 12 x 1.3 = 31.2px inside ~31px, which clipped the second line
        // through the middle even before any wrapping.
        padding: '4px 8px',
        fontSize: 10,
        lineHeight: 1.2,
        // 160 of the 180 dagre reserves (NODE_W), so ~25% more of the name is
        // visible than at 128 while the gap to the next node stays generous.
        width: 160,
        height: NODE_H,
        // The backstop. Each line already clips itself, so nothing should
        // reach this — which is exactly why it stays.
        overflow: 'hidden',
      },
      ...handles,
    };
  });
  return { nodes, edges };
}

export function WorkflowGraph({
  id,
  live,
  direction,
}: {
  id: number;
  live: boolean;
  /** Owned by the page, so its control can sit in the card header. */
  direction: Direction;
}) {
  const api = useApi(requestsApiRef);
  const [wf, setWf] = useState<WorkflowInfo>();

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
  );
}
