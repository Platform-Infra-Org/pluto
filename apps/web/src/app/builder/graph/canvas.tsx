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
import { byName, canConnect, connect } from './wiring'

// A graph node with a labelled input handle (left) per manifest input and an
// output handle (right) per declared output — the ports the owner wires.
function BlockNode({ data }: NodeProps) {
  const d = data as { label: string; kind: string; inputs: string[]; outputs: string[] }
  return (
    <div className="min-w-32 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <div className="font-medium">
        {d.label} <span className="text-muted-foreground">({d.kind})</span>
      </div>
      {d.inputs.map((name, i) => (
        <Handle
          key={`in-${name}`}
          id={name}
          type="target"
          position={Position.Left}
          style={{ top: 28 + i * 14 }}
        />
      ))}
      {d.outputs.map((name, i) => (
        <Handle
          key={`out-${name}`}
          id={name}
          type="source"
          position={Position.Right}
          style={{ top: 28 + i * 14 }}
        />
      ))}
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

  return (
    <div className="h-[520px] rounded-md border border-border">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
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
