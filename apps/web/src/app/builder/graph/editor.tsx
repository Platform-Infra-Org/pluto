import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { fetchBlocks, type Block } from '@/lib/blocks'
import type { GraphsJson, ServiceGraphJson, Verb } from '@/lib/graph'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { GraphCanvas } from './canvas'
import { Inspector } from './inspector'
import { Palette } from './palette'
import { GraphPreview } from './preview'
import { VerbTabs } from './verb-tabs'
import { emptyGraph } from './verbs'
import { addNode, byName } from './wiring'

const INITIAL: GraphsJson = { name: '', create: emptyGraph() }

// The graph editor (CB03): palette + canvas + inspector + per-verb tabs + live
// server-side preview. Service-owner-only (display gate; the BFF re-enforces it).
export function GraphEditor() {
  const { hasRole } = useAuth()
  const { data } = useQuery({ queryKey: ['blocks'], queryFn: fetchBlocks })
  const blocks: Block[] = data?.items ?? []
  const map = byName(blocks)

  const [graphs, setGraphs] = useState<GraphsJson>(INITIAL)
  const [active, setActive] = useState<Verb>('create')
  const [selected, setSelected] = useState<string | null>(null)

  if (!hasRole('service-owner'))
    return <p className="mx-auto max-w-lg px-4 py-8 text-sm text-destructive">Service owner access required.</p>

  const graph: ServiceGraphJson = graphs[active] ?? emptyGraph()
  const setGraph = (g: ServiceGraphJson) => setGraphs((gs) => ({ ...gs, [active]: g }))
  const addBlock = (b: Block) => b && setGraph(addNode(graph, b))

  return (
    <div className="mx-auto max-w-[110rem] space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Graph Editor</h1>
        <Input
          aria-label="service name"
          placeholder="service name"
          className="max-w-xs"
          value={graphs.name}
          onChange={(e) => setGraphs((gs) => ({ ...gs, name: e.target.value }))}
        />
      </div>

      <VerbTabs graphs={graphs} active={active} onActive={setActive} onChange={setGraphs} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr_20rem]">
        <Card className="p-3">
          <Palette onAdd={addBlock} />
        </Card>
        <GraphCanvas
          graph={graph}
          blocks={blocks}
          onChange={setGraph}
          onSelect={setSelected}
          onDropBlock={(name) => addBlock(map[name])}
        />
        <Card className="p-3">
          <Inspector graph={graph} selected={selected} blocks={blocks} onChange={setGraph} />
        </Card>
      </div>

      <Card className="p-4">
        <GraphPreview graphs={graphs} />
      </Card>
    </div>
  )
}
