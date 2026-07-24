import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { fetchBlocks, type Block } from '@/lib/blocks'
import { createDefinition, editDefinition } from '@/lib/services'
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
  const [subTab, setSubTab] = useState<'graph' | 'fields'>('graph')
  const [selected, setSelected] = useState<string | null>(null)
  const [defId, setDefId] = useState<number | null>(null)

  // Save & submit: ensure a DRAFT definition exists, then POST the composed graphs
  // to the BFF, which regenerates the artifacts (CB02) and re-enters onboarding.
  // The BFF forks a bumped version on a non-DRAFT definition (pin-until-migrated).
  const save = useMutation({
    mutationFn: async () => {
      let id = defId
      if (id == null) {
        const d = await createDefinition({
          name: graphs.name,
          form_schema: { type: 'object', properties: {} },
          ui_schema: {},
          workflow_binding: {},
          approval_policy: { mode: 'SINGLE' },
        })
        id = d.id
        setDefId(id)
      }
      return editDefinition(id, graphs)
    },
  })

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
        <Button
          type="button"
          disabled={!graphs.name.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          Save &amp; submit for onboarding
        </Button>
        {save.isSuccess && (
          <span className="text-sm text-muted-foreground">
            Submitted for onboarding (v{save.data.version}, request #{save.data.request_id}).
          </span>
        )}
        {save.isError && (
          <span role="alert" className="text-sm text-destructive">
            {(save.error as Error).message}
          </span>
        )}
      </div>

      <VerbTabs graphs={graphs} active={active} onActive={setActive} onChange={setGraphs} />

      {/* Sub-tabs within the active verb: the graph canvas vs. the request fields. */}
      <div role="tablist" aria-label="Editor section" className="flex gap-1 border-b border-border">
        {(['graph', 'fields'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={subTab === t}
            onClick={() => setSubTab(t)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
              subTab === t
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'graph' ? 'Graph' : 'Request fields'}
          </button>
        ))}
      </div>

      {subTab === 'fields' ? (
        <RequestFields graph={graph} onChange={setGraph} />
      ) : (
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
      )}

      <Card className="p-4">
        <GraphPreview graphs={graphs} />
      </Card>
    </div>
  )
}
