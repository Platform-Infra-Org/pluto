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
import { Typography } from '@material-ui/core';
import { requestsApiRef, WorkflowInfo, WorkflowNode } from '../api';

const PHASE_COLOR: Record<string, string> = {
  Succeeded: 'hsl(var(--sc-success))',
  Running: 'hsl(var(--sc-primary))',
  Pending: 'hsl(var(--sc-muted-fg))',
  Failed: 'hsl(var(--sc-destructive))',
  Error: 'hsl(var(--sc-destructive))',
  Skipped: 'hsl(var(--sc-muted-fg))',
};

// Depth of each node from roots (no incoming edge), following children.
function depths(nodes: WorkflowNode[]): Map<string, number> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const hasParent = new Set<string>();
  nodes.forEach(n => n.children.forEach(c => hasParent.add(c)));
  const out = new Map<string, number>();
  const walk = (id: string, d: number) => {
    if (!byId.has(id)) return;
    if ((out.get(id) ?? -1) >= d) return;
    out.set(id, d);
    byId.get(id)!.children.forEach(c => walk(c, d + 1));
  };
  nodes.filter(n => !hasParent.has(n.id)).forEach(n => walk(n.id, 0));
  nodes.forEach(n => !out.has(n.id) && out.set(n.id, 0));
  return out;
}

function toFlow(wf: WorkflowInfo): { nodes: Node[]; edges: Edge[] } {
  const d = depths(wf.nodes);
  const rowByCol = new Map<number, number>();
  const nodes: Node[] = wf.nodes.map(n => {
    const col = d.get(n.id) ?? 0;
    const row = rowByCol.get(col) ?? 0;
    rowByCol.set(col, row + 1);
    return {
      id: n.id,
      position: { x: col * 220, y: row * 80 },
      data: { label: `${n.name}\n${n.phase ?? ''}` },
      style: {
        border: `1.5px solid ${PHASE_COLOR[n.phase ?? 'Pending'] ?? 'hsl(var(--sc-muted-fg))'}`,
        background: '#17171f',
        color: '#e7e7ef',
        borderRadius: 8,
        padding: '5px 8px',
        fontSize: 10,
        lineHeight: 1.3,
        whiteSpace: 'pre-line',
        width: 128,
      },
    };
  });
  const edges: Edge[] = wf.nodes.flatMap(n =>
    n.children
      .filter(c => wf.nodes.some(m => m.id === c))
      .map(c => ({ id: `${n.id}->${c}`, source: n.id, target: c, animated: true })),
  );
  return { nodes, edges };
}

export function WorkflowGraph({ id, live }: { id: number; live: boolean }) {
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
  const { nodes, edges } = toFlow(wf);
  return (
    <div style={{ height: 300, background: '#0a0a10', borderRadius: 10 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.25 }}
        minZoom={0.4}
        maxZoom={1.25}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={17} size={1.2} color="#3a3a48" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
