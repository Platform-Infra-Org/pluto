import { useCallback, useMemo } from 'react'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Block } from '@/lib/blocks'
import type { NodeJson, ServiceGraphJson } from '@/lib/graph'
import { DRAG_MIME } from './palette'
import { byName, canConnect, connect, removeNode } from './wiring'

// A graph node: a header, then two columns — inputs (left) and outputs (right).
// Each port's Handle is absolutely positioned inside its own label row, so the
// connection dot lines up exactly with the input/output it represents.
function BlockNode({ data }: NodeProps) {
  const d = data as { label: string; kind: string; inputs: string[]; outputs: string[] }
  return (
    <div className="min-w-44 rounded-md border border-border bg-card text-xs shadow-sm">
      <div className="border-b border-border px-3 py-1.5 font-medium">
        {d.label} <span className="text-muted-foreground">({d.kind})</span>
      </div>
      <div className="flex justify-between gap-6 py-1.5">
        <div className="flex flex-col">
          {d.inputs.map((name) => (
            <div key={`in-${name}`} className="relative flex h-6 items-center pl-3 pr-2">
              <Handle
                id={name}
                type="target"
                position={Position.Left}
                style={{ position: 'absolute', left: 0, top: '50%' }}
              />
              <span className="text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-end">
          {d.outputs.map((name) => (
            <div key={`out-${name}`} className="relative flex h-6 items-center pl-2 pr-3">
              <span className="text-muted-foreground">{name}</span>
              <Handle
                id={name}
                type="source"
                position={Position.Right}
                style={{ position: 'absolute', right: 0, top: '50%' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const nodeTypes = { block: BlockNode }

function outRefEdges(graph: ServiceGraphJson): Edge[] {
  const edges: Edge[] = []
  const push = (b: unknown, target: string, input: string) => {
    const bind = b as { kind?: string; node?: string; output?: string }
    if (bind?.kind === 'output' && bind.node)
      edges.push({
        id: `${bind.node}.${bind.output}->${target}.${input}`,
        source: bind.node,
        sourceHandle: bind.output,
        target,
        targetHandle: input,
      })
  }
  for (const n of graph.nodes) {
    for (const [input, b] of Object.entries(n.input_bindings)) push(b, n.id, input)
    const body = (n.config.body ?? {}) as Record<string, unknown>
    for (const [k, b] of Object.entries(body)) push(b, n.id, k)
  }
  return edges
}

function layout(nodes: NodeJson[], blocks: Record<string, Block>): Node[] {
  return nodes.map((n, i) => ({
    id: n.id,
    type: 'block',
    position: { x: (i % 3) * 220, y: Math.floor(i / 3) * 140 },
    data: {
      label: n.block,
      kind: n.kind,
      inputs: (blocks[n.block]?.manifest.inputs ?? []).map((f) => f.name),
      outputs: n.outputs,
    },
  }))
}

export function GraphCanvas({
  graph,
  blocks,
  onChange,
  onSelect,
  onDropBlock,
}: {
  graph: ServiceGraphJson
  blocks: Block[]
  onChange: (g: ServiceGraphJson) => void
  onSelect: (id: string | null) => void
  onDropBlock: (blockName: string) => void
}) {
  const map = useMemo(() => byName(blocks), [blocks])
  const rfNodes = useMemo(() => layout(graph.nodes, map), [graph.nodes, map])
  const rfEdges = useMemo(() => outRefEdges(graph), [graph])

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || !c.sourceHandle || !c.targetHandle) return
      // Type-aware: silently refuse a wire whose source type can't feed the target.
      if (!canConnect(map, graph, c.source, c.sourceHandle, c.target, c.targetHandle)) return
      onChange(connect(graph, c.source, c.sourceHandle, c.target, c.targetHandle))
    },
    [map, graph, onChange],
  )

  // Delete key / RF delete affordance -> drop the node (and any bindings to it) from
  // the graph JSON so it stays removed. removeNode cleans dangling refs.
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      onChange(deleted.reduce((g, n) => removeNode(g, n.id), graph))
      onSelect(null)
    },
    [graph, onChange, onSelect],
  )

  return (
    <div className="h-[520px] rounded-md border border-border">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(e) => {
          e.preventDefault()
          const name = e.dataTransfer.getData(DRAG_MIME)
          if (name) onDropBlock(name)
        }}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
