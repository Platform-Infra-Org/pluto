import { useState } from 'react'
import type { Block } from '@/lib/blocks'
import { lit, outRef, ref, type Binding, type ServiceGraphJson } from '@/lib/graph'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  byName,
  markMain,
  missingRequired,
  setBinding,
  setBodyBinding,
  setConfig,
  setOutputs,
} from './wiring'

// Encode/decode a binding as a <select> value so the owner can pick the source of
// each input: a request field, another node's output, or a literal.
function bindingValue(b: Binding | undefined): string {
  if (!b) return ''
  if (b.kind === 'request') return `request:${b.field}`
  if (b.kind === 'output') return `output:${b.node}.${b.output}`
  return 'literal'
}

function decodeBinding(value: string): Binding | null {
  if (!value) return null
  if (value.startsWith('request:')) return ref(value.slice(8))
  if (value.startsWith('output:')) {
    const [node, output] = value.slice(7).split('.')
    return outRef(node, output)
  }
  return lit('')
}

// Right inspector: bind inputs, edit config, name outputs, and mark exactly one
// node `main`. Every edit routes through the pure ops in wiring.ts.
export function Inspector({
  graph,
  selected,
  blocks,
  onChange,
}: {
  graph: ServiceGraphJson
  selected: string | null
  blocks: Block[]
  onChange: (g: ServiceGraphJson) => void
}) {
  const [newField, setNewField] = useState('')
  const node = graph.nodes.find((n) => n.id === selected)
  if (!node) return <p className="text-sm text-muted-foreground">Select a node to edit it.</p>

  const map = byName(blocks)
  const block = map[node.block]
  const missing = missingRequired(block, node)

  // Sources the owner may bind an input to: request fields + other nodes' outputs.
  const outputSources = graph.nodes
    .filter((n) => n.id !== node.id)
    .flatMap((n) => n.outputs.map((o) => ({ value: `output:${n.id}.${o}`, label: `${n.id}.${o}` })))
  const requestSources = Object.keys(graph.request_fields).map((f) => ({
    value: `request:${f}`,
    label: `request.${f}`,
  }))

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-medium">
          {node.id} <span className="text-muted-foreground">({node.block})</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant={node.kind === 'main' ? 'success' : 'outline'}
          onClick={() => onChange(markMain(graph, node.id))}
        >
          {node.kind === 'main' ? 'main' : 'mark main'}
        </Button>
      </div>

      <Card className="space-y-3 p-3">
        <div className="text-xs font-medium text-muted-foreground">Inputs</div>
        {(block?.manifest.inputs ?? []).map((inp) => {
          const err = missing.includes(inp.name)
          return (
            <label key={inp.name} className="block space-y-1">
              <span className={err ? 'text-destructive' : ''}>
                {inp.name}
                <span className="text-muted-foreground"> : {inp.type}</span>
                {inp.required ? ' *' : ''}
              </span>
              <select
                aria-label={`bind ${inp.name}`}
                className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                value={bindingValue(node.input_bindings[inp.name])}
                onChange={(e) => onChange(setBinding(graph, node.id, inp.name, decodeBinding(e.target.value)))}
              >
                <option value="">— unbound —</option>
                {requestSources.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
                {outputSources.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
                <option value="literal">literal…</option>
              </select>
              {node.input_bindings[inp.name]?.kind === 'literal' && (
                <Input
                  aria-label={`${inp.name} literal`}
                  value={String((node.input_bindings[inp.name] as { value: unknown }).value ?? '')}
                  onChange={(e) => onChange(setBinding(graph, node.id, inp.name, lit(e.target.value)))}
                />
              )}
            </label>
          )
        })}
      </Card>

      <Card className="space-y-2 p-3">
        <div className="text-xs font-medium text-muted-foreground">Config</div>
        {['method', 'url'].map((key) => (
          <Input
            key={key}
            aria-label={`config ${key}`}
            placeholder={key}
            value={String(node.config[key] ?? '')}
            onChange={(e) => onChange(setConfig(graph, node.id, key, e.target.value))}
          />
        ))}
      </Card>

      {node.kind === 'main' && (
        <Card className="space-y-3 p-3">
          <div className="text-xs font-medium text-muted-foreground">
            Payload body (field → source)
          </div>
          {Object.entries((node.config.body as Record<string, Binding>) ?? {}).map(([field, b]) => (
            <label key={field} className="block space-y-1">
              <span>{field}</span>
              <div className="flex gap-2">
                <select
                  aria-label={`body ${field}`}
                  className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                  value={bindingValue(b)}
                  onChange={(e) => onChange(setBodyBinding(graph, node.id, field, decodeBinding(e.target.value)))}
                >
                  <option value="">— unbound —</option>
                  {requestSources.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                  {outputSources.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                  <option value="literal">literal…</option>
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`remove body ${field}`}
                  onClick={() => onChange(setBodyBinding(graph, node.id, field, null))}
                >
                  ×
                </Button>
              </div>
              {b?.kind === 'literal' && (
                <Input
                  aria-label={`body ${field} literal`}
                  value={String((b as { value: unknown }).value ?? '')}
                  onChange={(e) => onChange(setBodyBinding(graph, node.id, field, lit(e.target.value)))}
                />
              )}
            </label>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const name = newField.trim()
              if (name) onChange(setBodyBinding(graph, node.id, name, lit('')))
              setNewField('')
            }}
          >
            <Input
              aria-label="new body field"
              placeholder="body field name"
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
            />
            <Button type="submit" size="sm" variant="outline">
              add
            </Button>
          </form>
        </Card>
      )}

      <Card className="space-y-2 p-3">
        <div className="text-xs font-medium text-muted-foreground">Outputs (comma-separated)</div>
        <Input
          aria-label="outputs"
          value={node.outputs.join(', ')}
          onChange={(e) =>
            onChange(
              setOutputs(
                graph,
                node.id,
                e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              ),
            )
          }
        />
      </Card>
    </div>
  )
}
