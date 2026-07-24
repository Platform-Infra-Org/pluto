import { apiFetch } from './api'

// Graph JSON — the exact wire shape CB02 compiles (bff app/generator/graph.py).
// The editor produces this; the BFF `POST /api/services/generate` parses it.

export type Verb = 'create' | 'update' | 'delete'
export type Kind = 'main' | 'dependency' | 'internal'

// A per-input binding (tagged, matches graph.parse_binding).
export type Ref = { kind: 'request'; field: string }
export type OutRef = { kind: 'output'; node: string; output: string }
export type Lit = { kind: 'literal'; value: unknown }
export type Binding = Ref | OutRef | Lit

export const ref = (field: string): Ref => ({ kind: 'request', field })
export const outRef = (node: string, output: string): OutRef => ({ kind: 'output', node, output })
export const lit = (value: unknown): Lit => ({ kind: 'literal', value })

export interface NodeJson {
  id: string
  block: string // function-block name OR dependency service name
  kind: Kind
  action?: Verb | null // dependency nodes: create | update | delete
  config: Record<string, unknown> // literal config; `body` values are Bindings
  input_bindings: Record<string, Binding>
  outputs: string[]
}

export interface ServiceGraphJson {
  nodes: NodeJson[]
  request_fields: Record<string, string> // field -> CB01 type string
}

export interface GraphsJson {
  name: string
  create?: ServiceGraphJson
  update?: ServiceGraphJson
  delete?: ServiceGraphJson
}

export interface Generated {
  build_json_j2: string
  workflow_template_yaml: string
  errors: string[]
}

// Server-side preview (never generate YAML in the browser). Validation errors come
// back as `errors[]` with empty artifacts — the editor renders them live.
export function generate(graphs: GraphsJson) {
  return apiFetch<Generated>('/services/generate', {
    method: 'POST',
    body: JSON.stringify({ graphs }),
  })
}

export { fetchBlocks } from './blocks'
