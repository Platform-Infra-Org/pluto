import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { fetchResourceGraph, type ResourceGraph as Graph, type ResourceGraphNode } from '@/lib/catalog'

// Depth of each node from the root, following dependency edges (from -> to).
// Unreached nodes default to depth 0. Exported for unit testing the layout.
export function layoutByDepth(
  nodes: ResourceGraphNode[],
  edges: { from: number; to: number }[],
  rootId: number,
): Map<number, number> {
  const out = new Map<number, number>()
  for (const n of nodes) out.set(n.id, 0)
  const adj = new Map<number, number[]>()
  for (const e of edges) (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push(e.to)
  const queue: number[] = [rootId]
  const seen = new Set<number>([rootId])
  out.set(rootId, 0)
  while (queue.length) {
    const id = queue.shift()!
    const d = out.get(id) ?? 0
    for (const to of adj.get(id) ?? []) {
      if (!seen.has(to)) {
        seen.add(to)
        out.set(to, d + 1)
        queue.push(to)
      }
    }
  }
  return out
}

function ResourceNode({ data }: NodeProps) {
  const d = data as { name: string; type: string; resourceId: number; current: boolean }
  return (
    <Link
      to="/resources/$resourceId"
      params={{ resourceId: String(d.resourceId) }}
      className={`block min-w-40 rounded-md border px-3 py-2 text-xs shadow-sm ${
        d.current ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="font-medium">{d.name}</div>
      <div className="text-muted-foreground">{d.type}</div>
      <Handle type="source" position={Position.Right} />
    </Link>
  )
}

const nodeTypes = { resource: ResourceNode }

function toFlow(graph: Graph, currentId: number): { nodes: Node[]; edges: Edge[] } {
  const depth = layoutByDepth(graph.nodes, graph.edges, currentId)
  const rowByDepth = new Map<number, number>()
  const nodes: Node[] = graph.nodes.map((n) => {
    const d = depth.get(n.id) ?? 0
    const row = rowByDepth.get(d) ?? 0
    rowByDepth.set(d, row + 1)
    return {
      id: String(n.id),
      type: 'resource',
      position: { x: d * 240, y: row * 96 },
      data: { name: n.name, type: n.type, resourceId: n.id, current: n.id === currentId },
    }
  })
  const edges: Edge[] = graph.edges.map((e) => ({
    id: `${e.from}->${e.to}`,
    source: String(e.from),
    target: String(e.to),
    animated: true,
  }))
  return { nodes, edges }
}

export function ResourceGraph({ id }: { id: number }) {
  const { data } = useQuery({ queryKey: ['resource-graph', id], queryFn: () => fetchResourceGraph(id) })
  if (!data) return null
  if (data.nodes.length <= 1 && data.edges.length === 0)
    return <p className="text-sm text-muted-foreground">No dependencies.</p>

  const { nodes, edges } = toFlow(data, id)
  return (
    <div className="h-[420px] overflow-hidden rounded-md border border-border bg-background">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
