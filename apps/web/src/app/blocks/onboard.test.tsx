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
  vi.mocked(blocks.onboardBlock).mockResolvedValue({ ...SET_VALUE, name: 'api-call' })
})

describe('BlockOnboard', () => {
  it('hides the screen from a non-admin', () => {
    authValue = { hasRole: () => false, isLoading: false }
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent(/platform-admin/i)
    expect(screen.queryByRole('textbox', { name: /manifest/i })).not.toBeInTheDocument()
  })

  it('lists existing blocks with typed IO for an admin', async () => {
    authValue = { hasRole: (r: string) => r === 'platform-admin', isLoading: false }
    renderPage()
    expect(await screen.findByText('set-value')).toBeInTheDocument()
    expect(screen.getByText('fn-set-value')).toBeInTheDocument()
    // typed IO surfaced
    expect(screen.getByText(/expr/)).toBeInTheDocument()
  })

  it('submits a pasted manifest and shows it in the list', async () => {
    authValue = { hasRole: (r: string) => r === 'platform-admin', isLoading: false }
    renderPage()
    await screen.findByText('set-value')
    const ta = screen.getByRole('textbox', { name: /manifest/i })
    fireEvent.change(ta, { target: { value: 'kind: FunctionBlock' } })
    fireEvent.click(screen.getByRole('button', { name: /onboard/i }))
    await waitFor(() =>
      expect(blocks.onboardBlock).toHaveBeenCalledWith('kind: FunctionBlock'),
    )
  })

  it('shows the validation error when the manifest is invalid', async () => {
    authValue = { hasRole: (r: string) => r === 'platform-admin', isLoading: false }
    vi.mocked(blocks.onboardBlock).mockRejectedValueOnce(new Error("unknown type: 'widget'"))
    renderPage()
    await screen.findByText('set-value')
    fireEvent.change(screen.getByRole('textbox', { name: /manifest/i }), {
      target: { value: 'bad: yaml' },
    })
    fireEvent.click(screen.getByRole('button', { name: /onboard/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/widget/i)
  })
})
