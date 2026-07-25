import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as blocks from '@/lib/blocks'
import * as services from '@/lib/services'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authValue: any
vi.mock('@/lib/auth', () => ({ useAuth: () => authValue }))
vi.mock('@/lib/blocks')
vi.mock('@/lib/services')
// ReactFlow (canvas) needs ResizeObserver / live preview hits the network — both are
// out of scope here; stub them so the test isolates the save & submit flow.
vi.mock('./canvas', () => ({ GraphCanvas: () => null }))
vi.mock('./preview', () => ({ GraphPreview: () => null }))

import { GraphEditor } from './editor'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <GraphEditor />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  authValue = { hasRole: (r: string) => r === 'service-owner', isLoading: false }
  vi.mocked(blocks.fetchBlocks).mockResolvedValue({ items: [] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(services.createDefinition).mockResolvedValue({ id: 9 } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(services.editDefinition).mockResolvedValue({ version: 1, request_id: 4, definition: {} as any })
  vi.mocked(services.fetchIdFieldOptions).mockResolvedValue({
    options: ['metadata.name', 'payload.body.name'],
  })
})

describe('GraphEditor save & submit', () => {
  it('creates a draft then saves graphs + submits for onboarding', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('service name'), { target: { value: 'app-database' } })
    fireEvent.click(screen.getByRole('button', { name: /save.*submit/i }))

    await waitFor(() => expect(services.createDefinition).toHaveBeenCalled())
    await waitFor(() =>
      expect(services.editDefinition).toHaveBeenCalledWith(
        9,
        expect.objectContaining({ name: 'app-database' }),
        'metadata.name',
      ),
    )
    expect(await screen.findByText(/submitted for onboarding/i)).toBeInTheDocument()
  })

  it('renders fetched id-field options and includes the chosen id_field on save', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('service name'), { target: { value: 'app-database' } })

    const select = (await screen.findByLabelText('id field')) as HTMLSelectElement
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'payload.body.name' })).toBeInTheDocument(),
    )
    fireEvent.change(select, { target: { value: 'payload.body.name' } })
    fireEvent.click(screen.getByRole('button', { name: /save.*submit/i }))

    await waitFor(() =>
      expect(services.editDefinition).toHaveBeenCalledWith(
        9,
        expect.objectContaining({ name: 'app-database' }),
        'payload.body.name',
      ),
    )
  })
})
