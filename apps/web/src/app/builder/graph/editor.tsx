import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { fetchBlocks, type Block } from '@/lib/blocks'
import type { GraphsJson, ServiceGraphJson, Verb } from '@/lib/graph'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { GraphCanvas } from './canvas'
import { Inspector } from './inspector'
import { Palette } from './palette'
import { GraphPreview } from './preview'
import { VerbTabs } from './verb-tabs'
import { emptyGraph } from './verbs'
import { addNode, byName, removeRequestField, setRequestField } from './wiring'

const INITIAL: GraphsJson = { name: '', create: emptyGraph() }

const FIELD_TYPES = ['string', 'number', 'boolean', 'json', 'enum']

// The owner declares the service's request fields (name + type). These populate
// graph.request_fields so the inspector's `request.<field>` sources appear and the
// generated payload can bind body fields to request values.
function RequestFields({
  graph,
  onChange,
}: {
  graph: ServiceGraphJson
  onChange: (g: ServiceGraphJson) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('string')
  return (
    <Card className="space-y-2 p-3">
      <div className="text-xs font-medium text-muted-foreground">Request fields</div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(graph.request_fields).map(([f, t]) => (
          <span key={f} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs">
            {f} <span className="text-muted-foreground">: {t}</span>
            <button
              type="button"
              aria-label={`remove ${f}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange(removeRequestField(graph, f))}
            >
              ×
            </button>
          </span>
        ))}
        {Object.keys(graph.request_fields).length === 0 && (
          <span className="text-xs text-muted-foreground">none yet</span>
        )}
      </div>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          // ponytail: bare "enum" isn't a full CB01 type; richer enum[values] editing is CB04.
          if (n) onChange(setRequestField(graph, n, type))
          setName('')
        }}
      >
        <Input
          aria-label="request field name"
          placeholder="field name"
          className="max-w-[12rem]"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          aria-label="request field type"
          className="rounded-md border border-input bg-transparent px-2 py-1 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline">
          add field
        </Button>
      </form>
    </Card>
  )
}

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

      <RequestFields graph={graph} onChange={setGraph} />

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
