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
  version: 3,
  kind: 'function' as const,
  manifest: {
    name: 'set-value',
    category: 'builtin',
    icon: 'function',
    template_ref: 'fn-set-value',
    entrypoint: 'main',
    inputs: [{ name: 'method', type: 'enum[GET,POST]', required: true }],
    outputs: [{ name: 'value', type: 'json', required: false }],
    ui: {},
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(blocks.fetchBlocks).mockResolvedValue({ items: [SET_VALUE] })
  vi.mocked(blocks.onboardBlockForm).mockResolvedValue({ ...SET_VALUE, name: 'api-call' })
  vi.mocked(blocks.editBlock).mockResolvedValue({ ...SET_VALUE, version: 4 })
})

function asAdmin() {
  authValue = { hasRole: (r: string) => r === 'platform-admin', isLoading: false }
}

describe('BlockOnboard', () => {
  it('hides the screen from a non-admin', () => {
    authValue = { hasRole: () => false, isLoading: false }
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent(/platform-admin/i)
    expect(screen.queryByLabelText('block name')).not.toBeInTheDocument()
  })

  it('lists existing blocks with typed IO + version for an admin', async () => {
    asAdmin()
    renderPage()
    expect(await screen.findByText('set-value')).toBeInTheDocument()
    expect(screen.getByText('fn-set-value')).toBeInTheDocument()
    expect(screen.getByText('v3')).toBeInTheDocument()
    expect(screen.getByText(/method/)).toBeInTheDocument()
  })

  it('builds an enum type from the choice box and posts entrypoint', async () => {
    asAdmin()
    renderPage()
    await screen.findByText('set-value')
    fireEvent.change(screen.getByLabelText('block name'), { target: { value: 'slack-notify' } })
    fireEvent.change(screen.getByLabelText('template ref'), { target: { value: 'fn-slack-notify' } })
    fireEvent.change(screen.getByLabelText('entrypoint'), { target: { value: 'main' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 name'), { target: { value: 'verb' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 type'), { target: { value: 'enum' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 enum values'), { target: { value: 'GET, POST' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create block' }))
    await waitFor(() =>
      expect(blocks.onboardBlockForm).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'slack-notify',
          template_ref: 'fn-slack-notify',
          entrypoint: 'main',
          inputs: [{ name: 'verb', type: 'enum[GET,POST]', required: true }],
        }),
      ),
    )
  })

  it('builds a map type from the choice box', async () => {
    asAdmin()
    renderPage()
    await screen.findByText('set-value')
    fireEvent.change(screen.getByLabelText('block name'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('template ref'), { target: { value: 'fn-x' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 name'), { target: { value: 'rules' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 type'), { target: { value: 'map' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 value type'), { target: { value: 'jsonpath' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create block' }))
    await waitFor(() =>
      expect(blocks.onboardBlockForm).toHaveBeenCalledWith(
        expect.objectContaining({
          inputs: [{ name: 'rules', type: 'map<string,jsonpath>', required: true }],
        }),
      ),
    )
  })

  it('defaults entrypoint to run when left untouched', async () => {
    asAdmin()
    renderPage()
    await screen.findByText('set-value')
    fireEvent.change(screen.getByLabelText('block name'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('template ref'), { target: { value: 'fn-x' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 name'), { target: { value: 'a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create block' }))
    await waitFor(() =>
      expect(blocks.onboardBlockForm).toHaveBeenCalledWith(
        expect.objectContaining({ entrypoint: 'run' }),
      ),
    )
  })

  it('edits an existing block: prefills the form and PUTs an upsert', async () => {
    asAdmin()
    renderPage()
    await screen.findByText('set-value')
    fireEvent.click(screen.getByRole('button', { name: /edit set-value/i }))
    // Form is prefilled from the block's manifest.
    expect(screen.getByLabelText('block name')).toHaveValue('set-value')
    expect(screen.getByLabelText('template ref')).toHaveValue('fn-set-value')
    expect(screen.getByLabelText('entrypoint')).toHaveValue('main')
    expect(screen.getByLabelText('Inputs 0 type')).toHaveValue('enum')
    expect(screen.getByLabelText('Inputs 0 enum values')).toHaveValue('GET,POST')

    fireEvent.click(screen.getByRole('button', { name: /save block/i }))
    await waitFor(() =>
      expect(blocks.editBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'set-value',
          template_ref: 'fn-set-value',
          entrypoint: 'main',
          inputs: [{ name: 'method', type: 'enum[GET,POST]', required: true }],
        }),
      ),
    )
    expect(blocks.onboardBlockForm).not.toHaveBeenCalled()
  })

  it('shows the validation error when the block is rejected', async () => {
    asAdmin()
    vi.mocked(blocks.onboardBlockForm).mockRejectedValueOnce(new Error("unknown type: 'widget'"))
    renderPage()
    await screen.findByText('set-value')
    fireEvent.change(screen.getByLabelText('block name'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('template ref'), { target: { value: 'fn-x' } })
    fireEvent.change(screen.getByLabelText('Inputs 0 name'), { target: { value: 'a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create block' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/widget/i)
  })
})
