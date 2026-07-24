import { useState } from 'react'
import type { Block } from '@/lib/blocks'
import { isBinding, lit, outRef, ref, type Binding, type InputValue, type ServiceGraphJson } from '@/lib/graph'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { byName, markMain, missingRequired, setInput, setInputMapEntry, setOutputs } from './wiring'

type Source = { value: string; label: string }

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

// Parse the values out of an `enum[A,B,C]` type string; null for non-enum types.
function enumValues(type: string | undefined): string[] | null {
  const m = type?.match(/^enum\[(.*)\]$/)
  return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : null
}

// A map-shaped input (api-call `body`, or a `map<...>` type like json-extractor
// `rules`) is edited as a key→source sub-editor; everything else is a single scalar.
function isMapInput(name: string, type: string): boolean {
  return name === 'body' || type.startsWith('map<')
}

// The value type of a `map<string,T>` input (T), or `json` for the untyped `body` map.
function mapValueType(type: string): string {
  const m = type.match(/^map<[^,]*,(.*)>$/)
  return m ? m[1].trim() : 'json'
}

const selectClass = 'w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm'

// One input control: a source picker (— unbound —, request/output sources, literal…)
// plus, when bound to a literal, an enum choice box or a free-text input by type.
function BindingControl({
  label,
  binding,
  type,
  requestSources,
  outputSources,
  onChange,
}: {
  label: string
  binding: Binding | undefined
  type: string
  requestSources: Source[]
  outputSources: Source[]
  onChange: (b: Binding | null) => void
}) {
  const enumOpts = enumValues(type)
  const literalValue = String((binding as { value?: unknown } | undefined)?.value ?? '')
  return (
    <>
      <select
        aria-label={`bind ${label}`}
        className={selectClass}
        value={bindingValue(binding)}
        onChange={(e) => onChange(decodeBinding(e.target.value))}
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
      {binding?.kind === 'literal' &&
        (enumOpts ? (
          <select
            aria-label={`${label} literal`}
            className={selectClass}
            value={literalValue}
            onChange={(e) => onChange(lit(e.target.value))}
          >
            <option value="">— choose —</option>
            {enumOpts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <Input
            aria-label={`${label} literal`}
            value={literalValue}
            onChange={(e) => onChange(lit(e.target.value))}
          />
        ))}
    </>
  )
}

// Right inspector: bind every input in ONE place, name outputs, and mark exactly one
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
  const [newKey, setNewKey] = useState('')
  const node = graph.nodes.find((n) => n.id === selected)
  if (!node) return <p className="text-sm text-muted-foreground">Select a node to edit it.</p>

  const map = byName(blocks)
  const block = map[node.block]
  const missing = missingRequired(block, node)

  // Sources the owner may bind an input to: request fields + other nodes' outputs.
  const outputSources: Source[] = graph.nodes
    .filter((n) => n.id !== node.id)
    .flatMap((n) => n.outputs.map((o) => ({ value: `output:${n.id}.${o}`, label: `${n.id}.${o}` })))
  const requestSources: Source[] = Object.keys(graph.request_fields).map((f) => ({
    value: `request:${f}`,
    label: `request.${f}`,
  }))

  // A map input's value is a {key: Binding} record — anything that isn't itself a
  // Binding. Use isBinding (not `'kind' in v`) so a map key literally named "kind"
  // doesn't make the sub-editor render empty.
  const asMap = (v: InputValue | undefined): Record<string, Binding> =>
    !v || isBinding(v) ? {} : (v as Record<string, Binding>)

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
          const val = node.input_bindings[inp.name]
          return (
            <div key={inp.name} className="space-y-1">
              <div className={err ? 'text-destructive' : ''}>
                {inp.name}
                <span className="text-muted-foreground"> : {inp.type}</span>
                {inp.required ? ' *' : ''}
              </div>
              {isMapInput(inp.name, inp.type) ? (
                <div className="space-y-2">
                  {Object.entries(asMap(val)).map(([key, b]) => (
                    <div key={key} className="space-y-1 rounded-md border border-border p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{key}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`remove ${inp.name} ${key}`}
                          onClick={() => onChange(setInputMapEntry(graph, node.id, inp.name, key, null))}
                        >
                          ×
                        </Button>
                      </div>
                      <BindingControl
                        label={`${inp.name} ${key}`}
                        binding={b}
                        type={mapValueType(inp.type)}
                        requestSources={requestSources}
                        outputSources={outputSources}
                        onChange={(nb) =>
                          onChange(setInputMapEntry(graph, node.id, inp.name, key, nb))
                        }
                      />
                    </div>
                  ))}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const key = newKey.trim()
                      if (key) onChange(setInputMapEntry(graph, node.id, inp.name, key, lit('')))
                      setNewKey('')
                    }}
                  >
                    <Input
                      aria-label={`new ${inp.name} key`}
                      placeholder={`${inp.name} key`}
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                    />
                    <Button type="submit" size="sm" variant="outline">
                      add
                    </Button>
                  </form>
                </div>
              ) : (
                <BindingControl
                  label={inp.name}
                  binding={val as Binding | undefined}
                  type={inp.type}
                  requestSources={requestSources}
                  outputSources={outputSources}
                  onChange={(b) => onChange(setInput(graph, node.id, inp.name, b))}
                />
              )}
            </div>
          )
        })}
      </Card>

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
