import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as blocks from '@/lib/blocks'

vi.mock('@/lib/blocks')

import { Palette } from './palette'

const API_CALL = {
  name: 'api-call',
  version: 1,
  kind: 'function' as const,
  manifest: {
    name: 'api-call',
    category: 'builtin',
    icon: 'globe',
    template_ref: 'fn-api-call',
    inputs: [{ name: 'url', type: 'string', required: true }],
    outputs: [{ name: 'response', type: 'json', required: false }],
    ui: {},
  },
}
const NETWORK = {
  name: 'network',
  version: 1,
  kind: 'service' as const,
  manifest: {
    name: 'network',
    category: 'service',
    icon: 'box',
    template_ref: 'network',
    inputs: [{ name: 'region', type: 'string', required: true }],
    outputs: [{ name: 'subnet_id', type: 'string', required: false }],
    ui: {},
  },
}

function renderPalette() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Palette onAdd={() => {}} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(blocks.fetchBlocks).mockResolvedValue({ items: [API_CALL, NETWORK] })
})

describe('Palette', () => {
  it('lists function + service blocks with typed ports', async () => {
    renderPalette()
    expect(await screen.findByText('api-call')).toBeInTheDocument()
    expect(screen.getByText('network')).toBeInTheDocument()
    // typed ports surfaced so the owner can see what wires
    expect(screen.getByText(/subnet_id/)).toBeInTheDocument()
    expect(screen.getByText(/response/)).toBeInTheDocument()
  })
})
