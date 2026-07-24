import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/graph', async (orig) => ({
  ...(await orig<typeof import('@/lib/graph')>()),
  generate: vi.fn(),
}))

import { generate, type GraphsJson } from '@/lib/graph'
import { GraphPreview } from './preview'

const g = (name: string): GraphsJson => ({ name, create: { nodes: [], request_fields: {} } })

beforeEach(() => vi.mocked(generate).mockReset())

describe('GraphPreview', () => {
  it('shows the generated artifacts and re-generates on graph change', async () => {
    vi.mocked(generate).mockResolvedValue({
      build_json_j2: 'BUILD_JSON_ONE',
      workflow_template_yaml: 'kind: WorkflowTemplate # one',
      errors: [],
    })
    const { rerender } = render(<GraphPreview graphs={g('one')} debounceMs={0} />)
    expect(await screen.findByText(/BUILD_JSON_ONE/)).toBeInTheDocument()
    expect(screen.getByText(/kind: WorkflowTemplate/)).toBeInTheDocument()

    vi.mocked(generate).mockResolvedValue({
      build_json_j2: 'BUILD_JSON_TWO',
      workflow_template_yaml: 'kind: WorkflowTemplate # two',
      errors: [],
    })
    rerender(<GraphPreview graphs={g('two')} debounceMs={0} />)
    expect(await screen.findByText(/BUILD_JSON_TWO/)).toBeInTheDocument()
    expect(generate).toHaveBeenLastCalledWith(g('two'))
  })

  it('shows validation errors, not YAML, for an invalid graph', async () => {
    vi.mocked(generate).mockResolvedValue({
      build_json_j2: '',
      workflow_template_yaml: '',
      errors: ['[main] exactly one `main` node required (found 2)'],
    })
    render(<GraphPreview graphs={g('bad')} debounceMs={0} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/exactly one .main./i)
    expect(screen.queryByText(/kind: WorkflowTemplate/)).not.toBeInTheDocument()
  })
})
