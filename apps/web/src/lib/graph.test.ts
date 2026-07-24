import { describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from './api'
import { generate, lit, outRef, ref, type GraphsJson } from './graph'

const GRAPHS: GraphsJson = {
  name: 'svc',
  create: {
    request_fields: { app_name: 'string' },
    nodes: [
      {
        id: 'main',
        block: 'api-call',
        kind: 'main',
        config: { method: 'POST', url: 'https://x/y', body: { name: ref('app_name') } },
        input_bindings: {},
        outputs: [],
      },
    ],
  },
}

describe('graph client', () => {
  it('binding constructors produce CB02-tagged shapes', () => {
    expect(ref('app_name')).toEqual({ kind: 'request', field: 'app_name' })
    expect(outRef('network', 'subnet_id')).toEqual({
      kind: 'output',
      node: 'network',
      output: 'subnet_id',
    })
    expect(lit(42)).toEqual({ kind: 'literal', value: 42 })
  })

  it('generate() POSTs the graphs to the generate endpoint', async () => {
    const result = { build_json_j2: '{...}', workflow_template_yaml: 'kind: WorkflowTemplate', errors: [] }
    vi.mocked(apiFetch).mockResolvedValue(result)
    const got = await generate(GRAPHS)
    expect(got).toEqual(result)
    expect(apiFetch).toHaveBeenCalledWith('/services/generate', {
      method: 'POST',
      body: JSON.stringify({ graphs: GRAPHS }),
    })
  })
})
