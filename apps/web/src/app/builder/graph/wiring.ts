// Pure graph-editing + type-checking helpers (the testable heart of the canvas).
// React Flow interactions call these; the logic itself is DOM-free and unit-tested.
import type { Block, IOFieldDto } from '@/lib/blocks'
import { outRef, type Binding, type Kind, type NodeJson, type ServiceGraphJson } from '@/lib/graph'

export function byName(blocks: Block[]): Record<string, Block> {
  return Object.fromEntries(blocks.map((b) => [b.name, b]))
}

// A dropped block defaults to dependency (service) or internal (function). The
// owner promotes exactly one node to `main` in the inspector.
export function defaultKind(block: Block): Kind {
  return block.kind === 'service' ? 'dependency' : 'internal'
}

function uniqueId(graph: ServiceGraphJson, base: string): string {
  const taken = new Set(graph.nodes.map((n) => n.id))
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
}

// Drop a block onto the canvas -> append a node to the graph JSON (immutably).
export function addNode(graph: ServiceGraphJson, block: Block, id?: string): ServiceGraphJson {
  const node: NodeJson = {
    id: uniqueId(graph, id ?? block.name),
    block: block.name,
    kind: defaultKind(block),
    action: block.kind === 'service' ? 'create' : null,
    config: {},
    input_bindings: {},
    outputs: block.manifest.outputs.map((o) => o.name),
  }
  return { ...graph, nodes: [...graph.nodes, node] }
}

const dropRefsTo = (id: string) => (m: Record<string, Binding>) =>
  Object.fromEntries(Object.entries(m).filter(([, b]) => !(b.kind === 'output' && b.node === id)))

export function removeNode(graph: ServiceGraphJson, id: string): ServiceGraphJson {
  const drop = dropRefsTo(id)
  return {
    ...graph,
    nodes: graph.nodes
      .filter((n) => n.id !== id)
      // drop any bindings that referenced the removed node (inputs + main config.body)
      .map((n) => {
        const body = n.config.body as Record<string, Binding> | undefined
        return {
          ...n,
          input_bindings: drop(n.input_bindings),
          config: body ? { ...n.config, body: drop(body) } : n.config,
        }
      }),
  }
}

// --- Inspector node ops (bindings / config / outputs / main flag), all immutable.

function patch(graph: ServiceGraphJson, id: string, fn: (n: NodeJson) => NodeJson): ServiceGraphJson {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? fn(n) : n)) }
}

// Bind one input (request field | node output | literal). Passing null clears it.
export function setBinding(
  graph: ServiceGraphJson,
  id: string,
  input: string,
  binding: Binding | null,
): ServiceGraphJson {
  return patch(graph, id, (n) => {
    const input_bindings = { ...n.input_bindings }
    if (binding === null) delete input_bindings[input]
    else input_bindings[input] = binding
    return { ...n, input_bindings }
  })
}

export function setConfig(graph: ServiceGraphJson, id: string, key: string, value: unknown): ServiceGraphJson {
  return patch(graph, id, (n) => ({ ...n, config: { ...n.config, [key]: value } }))
}

// Bind one field of the main node's payload `config.body` (bodyField -> binding).
// Writes to config.body (what the generator's _payload consumes), NOT input_bindings.
// Passing null clears the field.
export function setBodyBinding(
  graph: ServiceGraphJson,
  id: string,
  field: string,
  binding: Binding | null,
): ServiceGraphJson {
  return patch(graph, id, (n) => {
    const body = { ...((n.config.body as Record<string, Binding>) ?? {}) }
    if (binding === null) delete body[field]
    else body[field] = binding
    return { ...n, config: { ...n.config, body } }
  })
}

// --- Request-field editor ops (graph.request_fields = field -> CB01 type string).

export function setRequestField(graph: ServiceGraphJson, name: string, type: string): ServiceGraphJson {
  return { ...graph, request_fields: { ...graph.request_fields, [name]: type } }
}

export function removeRequestField(graph: ServiceGraphJson, name: string): ServiceGraphJson {
  const request_fields = { ...graph.request_fields }
  delete request_fields[name]
  return { ...graph, request_fields }
}

export function setOutputs(graph: ServiceGraphJson, id: string, outputs: string[]): ServiceGraphJson {
  return patch(graph, id, (n) => ({ ...n, outputs }))
}

// Mark exactly one node `main` (design §4): the previous main reverts to internal.
export function markMain(graph: ServiceGraphJson, id: string): ServiceGraphJson {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (n.id === id) return { ...n, kind: 'main' }
      if (n.kind === 'main') return { ...n, kind: 'internal' }
      return n
    }),
  }
}

// Required inputs neither bound nor set in config (mirrors validate._check_required).
export function missingRequired(block: Block | undefined, node: NodeJson): string[] {
  if (!block) return []
  return block.manifest.inputs
    .filter((f) => f.required && !(f.name in node.input_bindings) && !(f.name in node.config))
    .map((f) => f.name)
}

// --- Type system mirror of CB01 manifest.is_assignable (bff app/blocks/manifest.py).
// Kept in the browser only to flag bad wires early; the BFF re-validates on generate.
export type IOType =
  | { kind: 'string' | 'number' | 'boolean' | 'json' | 'jsonpath' | 'secretRef' }
  | { kind: 'enum'; values: string[] }
  | { kind: 'map'; value: IOType }

export function parseType(spec: string): IOType {
  const s = spec.trim()
  if (s.startsWith('enum[') && s.endsWith(']'))
    return { kind: 'enum', values: s.slice(5, -1).split(',').map((v) => v.trim()).filter(Boolean) }
  if (s.startsWith('map<') && s.endsWith('>')) {
    const inner = s.slice(4, -1)
    const val = inner.slice(inner.indexOf(',') + 1)
    return { kind: 'map', value: parseType(val) }
  }
  return { kind: s as IOType['kind'] } as IOType
}

export function isAssignable(src: IOType, dst: IOType): boolean {
  if (dst.kind === 'json') return true // permissive top type
  if (src.kind === 'json') return false // ...but json won't narrow
  if (src.kind !== dst.kind) return false
  if (dst.kind === 'enum' && src.kind === 'enum')
    return src.values.every((v) => dst.values.includes(v))
  if (dst.kind === 'map' && src.kind === 'map') return isAssignable(src.value, dst.value)
  return true
}

const findType = (fields: IOFieldDto[], name: string) => fields.find((f) => f.name === name)?.type

export function outputType(block: Block | undefined, name: string): string | undefined {
  return block && findType(block.manifest.outputs, name)
}
export function inputType(block: Block | undefined, name: string): string | undefined {
  return block && findType(block.manifest.inputs, name)
}

// Type-aware wiring check: source node's output type must be assignable to the
// target node's input type (design §11 / global constraint).
export function canConnect(
  blocks: Record<string, Block>,
  graph: ServiceGraphJson,
  srcNode: string,
  srcOut: string,
  dstNode: string,
  dstInput: string,
): boolean {
  if (srcNode === dstNode) return false
  const nodes = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
  const src = outputType(blocks[nodes[srcNode]?.block], srcOut)
  const dst = inputType(blocks[nodes[dstNode]?.block], dstInput)
  if (!src || !dst) return false
  return isAssignable(parseType(src), parseType(dst))
}

// Perform a wire: bind dstNode.dstInput to srcNode.srcOut (an implied edge).
export function connect(
  graph: ServiceGraphJson,
  srcNode: string,
  srcOut: string,
  dstNode: string,
  dstInput: string,
): ServiceGraphJson {
  return {
    ...graph,
    nodes: graph.nodes.map((n) =>
      n.id === dstNode
        ? { ...n, input_bindings: { ...n.input_bindings, [dstInput]: outRef(srcNode, srcOut) } }
        : n,
    ),
  }
}
