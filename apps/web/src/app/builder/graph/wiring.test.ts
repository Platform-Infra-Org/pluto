import { describe, expect, it } from 'vitest'
import type { Block } from '@/lib/blocks'
import { outRef, ref, type ServiceGraphJson } from '@/lib/graph'
import {
  addNode,
  byName,
  canConnect,
  connect,
  isAssignable,
  parseType,
  removeNode,
  removeRequestField,
  setInputMapEntry,
  setRequestField,
} from './wiring'

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
      { name: 'url', type: 'string', required: true },
      { name: 'body', type: 'json' },
    ],
    outputs: [{ name: 'response', type: 'json' }],
    ui: {},
  },
}

const network: Block = {
  name: 'network',
  version: 1,
  kind: 'service',
  manifest: {
    name: 'network',
    category: 'service',
    icon: 'box',
    template_ref: 'network',
    inputs: [{ name: 'region', type: 'string', required: true }],
    outputs: [{ name: 'subnet_id', type: 'string' }],
    ui: {},
  },
}

const blocks = byName([apiCall, network])
const empty: ServiceGraphJson = { nodes: [], request_fields: {} }

describe('type system mirror', () => {
  it('json is the permissive top type', () => {
    expect(isAssignable(parseType('string'), parseType('json'))).toBe(true)
    expect(isAssignable(parseType('json'), parseType('string'))).toBe(false)
  })
  it('scalars must match', () => {
    expect(isAssignable(parseType('string'), parseType('string'))).toBe(true)
    expect(isAssignable(parseType('number'), parseType('string'))).toBe(false)
  })
})

describe('addNode', () => {
  it('drops a block as a node in the graph JSON (service -> dependency)', () => {
    const g = addNode(empty, network, 'network')
    expect(g.nodes).toHaveLength(1)
    expect(g.nodes[0]).toMatchObject({ id: 'network', block: 'network', kind: 'dependency' })
    // outputs seeded from the manifest so they can be wired downstream
    expect(g.nodes[0].outputs).toEqual(['subnet_id'])
    expect(empty.nodes).toHaveLength(0) // pure — original untouched
  })
})

describe('wiring (type-aware)', () => {
  const g: ServiceGraphJson = {
    request_fields: {},
    nodes: [
      { id: 'network', block: 'network', kind: 'dependency', input_bindings: {}, outputs: ['subnet_id'] },
      { id: 'main', block: 'api-call', kind: 'main', input_bindings: {}, outputs: [] },
    ],
  }

  it('a compatible wire creates an OutRef binding (edge) in the graph JSON', () => {
    // network.subnet_id (string) -> main.url (string): OK
    expect(canConnect(blocks, g, 'network', 'subnet_id', 'main', 'url')).toBe(true)
    const wired = connect(g, 'network', 'subnet_id', 'main', 'url')
    expect(wired.nodes.find((n) => n.id === 'main')!.input_bindings.url).toEqual({
      kind: 'output',
      node: 'network',
      output: 'subnet_id',
    })
    expect(g.nodes.find((n) => n.id === 'main')!.input_bindings.url).toBeUndefined() // pure
  })

  it('refuses an incompatible-type wire', () => {
    // main.response is json -> network.region (string): json cannot narrow -> refused
    const g2: ServiceGraphJson = {
      ...g,
      nodes: g.nodes.map((n) => (n.id === 'main' ? { ...n, outputs: ['response'] } : n)),
    }
    expect(canConnect(blocks, g2, 'main', 'response', 'network', 'region')).toBe(false)
  })
})

describe('request fields', () => {
  const g: ServiceGraphJson = { nodes: [], request_fields: {} }

  it('adds a named request field with a type', () => {
    const next = setRequestField(g, 'app_name', 'string')
    expect(next.request_fields).toEqual({ app_name: 'string' })
    expect(g.request_fields).toEqual({}) // pure
  })

  it('removes a request field', () => {
    const two = setRequestField(setRequestField(g, 'a', 'string'), 'b', 'number')
    expect(removeRequestField(two, 'a').request_fields).toEqual({ b: 'number' })
  })
})

describe('main node body binding (a map-shaped input under input_bindings)', () => {
  const g: ServiceGraphJson = {
    request_fields: { app_name: 'string' },
    nodes: [{ id: 'main', block: 'api-call', kind: 'main', input_bindings: {}, outputs: [] }],
  }

  it('binds a body key to a request field as input_bindings.body[key]', () => {
    const next = setInputMapEntry(g, 'main', 'body', 'name', ref('app_name'))
    const main = next.nodes.find((n) => n.id === 'main')!
    expect(main.input_bindings.body).toEqual({ name: { kind: 'request', field: 'app_name' } })
    expect(g.nodes[0].input_bindings.body).toBeUndefined() // pure
  })

  it('clears a body key when passed null (the body map stays)', () => {
    const withBody = setInputMapEntry(g, 'main', 'body', 'name', ref('app_name'))
    expect(setInputMapEntry(withBody, 'main', 'body', 'name', null).nodes[0].input_bindings.body).toEqual({})
  })
})

describe('removeNode', () => {
  const g: ServiceGraphJson = {
    request_fields: {},
    nodes: [
      { id: 'net', block: 'network', kind: 'dependency', input_bindings: {}, outputs: ['subnet_id'] },
      {
        id: 'main',
        block: 'api-call',
        kind: 'main',
        input_bindings: { url: outRef('net', 'subnet_id'), body: { subnet: outRef('net', 'subnet_id') } },
        outputs: [],
      },
    ],
  }

  it('removes the node and cleans dangling OutRefs to it (scalar + map-shaped inputs)', () => {
    const next = removeNode(g, 'net')
    expect(next.nodes.map((n) => n.id)).toEqual(['main'])
    const main = next.nodes[0]
    expect(main.input_bindings.url).toBeUndefined() // dangling scalar OutRef dropped
    expect(main.input_bindings.body).toEqual({}) // dangling body OutRef dropped, map kept
    expect(g.nodes).toHaveLength(2) // pure
  })
})
