import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as blocks from '@/lib/blocks'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authValue: any
vi.mock('@/lib/auth', () => ({ useAuth: () => authValue }))
vi.mock('@/lib/blocks')

import { BlockOnboard } from './onboard'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BlockOnboard />
    </QueryClientProvider>,
  )
}

const SET_VALUE = {
  name: 'set-value',
  version: 1,
  kind: 'function' as const,
  manifest: {
    name: 'set-value',
    category: 'builtin',
    icon: 'function',
    template_ref: 'fn-set-value',
    inputs: [{ name: 'expr', type: 'string', required: true }],
    outputs: [{ name: 'value', type: 'json', required: false }],
    ui: {},
  },
}

beforeEach(() => {
  vi.mocked(blocks.fetchBlocks).mockResolvedValue({ items: [SET_VALUE] })
  vi.mocked(blocks.onboardBlockForm).mockResolvedValue({ ...SET_VALUE, name: 'api-call' })
})

describe('BlockOnboard', () => {
  it('hides the screen from a non-admin', () => {
    authValue = { hasRole: () => false, isLoading: false }
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent(/platform-admin/i)
    expect(screen.queryByLabelText('block name')).not.toBeInTheDocument()
  })

  it('lists existing blocks with typed IO for an admin', async () => {
    authValue = { hasRole: (r: string) => r === 'platform-admin', isLoading: false }
    renderPage()
    expect(await screen.findByText('set-value')).toBeInTheDocument()
    expect(screen.getByText('fn-set-value')).toBeInTheDocument()
    expect(screen.getByText(/expr/)).toBeInTheDocument()
  })

  it('builds a manifest from the form and submits it (manifest_json, not YAML)', async () => {
    authValue = { hasRole: (r: string) => r === 'platform-admin', isLoading: false }
    renderPage()
    await screen.findByText('set-value')
    fireEvent.change(screen.getByLabelText('block name'), { target: { value: 'slack-notify' } })
    fireEvent.change(screen.getByLabelText('template ref'), { target: { value: 'fn-slack-notify' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 name'), { target: { value: 'channel' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 type'), { target: { value: 'string' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create block' }))
    await waitFor(() =>
      expect(blocks.onboardBlockForm).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'slack-notify',
          template_ref: 'fn-slack-notify',
          inputs: [{ name: 'channel', type: 'string', required: true }],
        }),
      ),
    )
  })

  it('shows the validation error when the block is rejected', async () => {
    authValue = { hasRole: (r: string) => r === 'platform-admin', isLoading: false }
    vi.mocked(blocks.onboardBlockForm).mockRejectedValueOnce(new Error("unknown type: 'widget'"))
    renderPage()
    await screen.findByText('set-value')
    fireEvent.change(screen.getByLabelText('block name'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('template ref'), { target: { value: 'fn-x' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 type'), { target: { value: 'widget' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 name'), { target: { value: 'a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create block' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/widget/i)
  })
})
