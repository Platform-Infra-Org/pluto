import { describe, expect, it } from 'vitest'
import type { Block } from '@/lib/blocks'
import { ref, type ServiceGraphJson } from '@/lib/graph'
import { markMain, missingRequired, setInput, setOutputs } from './wiring'

const apiCall: Block = {
  name: 'api-call',
  version: 1,
  kind: 'function',
  manifest: {
    name: 'api-call',
    category: 'builtin',
    icon: 'globe',
    template_ref: 'fn-api-call',
    inputs: [
      { name: 'method', type: 'string', required: true },
      { name: 'url', type: 'string', required: true },
    ],
    outputs: [{ name: 'response', type: 'json' }],
    ui: {},
  },
}

const graph: ServiceGraphJson = {
  request_fields: { host: 'string' },
  nodes: [
    { id: 'a', block: 'api-call', kind: 'main', input_bindings: { method: { kind: 'literal', value: 'GET' } }, outputs: [] },
    { id: 'b', block: 'api-call', kind: 'internal', input_bindings: { method: { kind: 'literal', value: 'GET' }, url: { kind: 'literal', value: 'x' } }, outputs: [] },
  ],
}

describe('inspector node ops', () => {
  it('binding a required input clears its error', () => {
    const node = graph.nodes[0] // `url` required, unbound
    expect(missingRequired(apiCall, node)).toContain('url')
    const g = setInput(graph, 'a', 'url', ref('host'))
    const bound = g.nodes.find((n) => n.id === 'a')!
    expect(bound.input_bindings.url).toEqual({ kind: 'request', field: 'host' })
    expect(missingRequired(apiCall, bound)).not.toContain('url')
    expect(graph.nodes[0].input_bindings.url).toBeUndefined() // pure
  })

  it('marking a second node main unmarks the first', () => {
    const g = markMain(graph, 'b')
    expect(g.nodes.find((n) => n.id === 'b')!.kind).toBe('main')
    expect(g.nodes.find((n) => n.id === 'a')!.kind).toBe('internal')
    // exactly one main
    expect(g.nodes.filter((n) => n.kind === 'main')).toHaveLength(1)
  })

  it('names a node output', () => {
    const g = setOutputs(graph, 'b', ['response'])
    expect(g.nodes.find((n) => n.id === 'b')!.outputs).toEqual(['response'])
  })
})
