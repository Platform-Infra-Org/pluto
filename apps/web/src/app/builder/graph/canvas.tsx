import { useCallback, useEffect, useMemo } from 'react'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Block } from '@/lib/blocks'
import { isBinding, type NodeJson, type ServiceGraphJson } from '@/lib/graph'
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
  const push = (b: { kind?: string; node?: string; output?: string }, target: string, input: string) => {
    if (b?.kind === 'output' && b.node)
      edges.push({
        id: `${b.node}.${b.output}->${target}.${input}`,
        source: b.node,
        sourceHandle: b.output,
        target,
        targetHandle: input,
      })
  }
  // Draw an edge for every OutRef, whether it's a scalar input binding or an entry
  // of a map-shaped input (body/rules) — the target handle is always the input name.
  for (const n of graph.nodes) {
    for (const [input, v] of Object.entries(n.input_bindings)) {
      if (isBinding(v)) push(v, n.id, input)
      else for (const b of Object.values(v)) push(b, n.id, input)
    }
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
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([])
  const rfEdges = useMemo(() => outRefEdges(graph), [graph])

  // Reconcile the React Flow node list when the graph changes (add/remove/relabel),
  // preserving any positions the user has dragged this session so nodes stay put.
  useEffect(() => {
    setRfNodes((prev) => {
      const pos = new Map(prev.map((n) => [n.id, n.position]))
      return layout(graph.nodes, map).map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }))
    })
  }, [graph.nodes, map, setRfNodes])

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
    <div className="h-full min-h-[520px] overflow-hidden rounded-md border border-border bg-background">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
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
