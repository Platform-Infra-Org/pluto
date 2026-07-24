import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as catalog from '@/lib/catalog'
import * as requests from '@/lib/requests'
import { ResourceEdit } from './edit'

vi.mock('@/lib/catalog')
vi.mock('@/lib/requests')

const resource = {
  id: 5,
  type: 'database',
  name: 'orders-db',
  owner_team: 'payments',
  git_path: 'x',
  git_sha: 'abc',
  status: 'active',
  updated_at: null,
  payload: { spec: { engine: 'postgres', size: 'medium' } },
}

function renderEdit() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ResourceEdit id={5} />
    </QueryClientProvider>,
  )
}

describe('ResourceEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(catalog.fetchResource).mockResolvedValue(resource as never)
    vi.mocked(requests.submitRequest).mockResolvedValue({ id: 12, state: 'PENDING_APPROVAL', owner_team: 'payments' } as never)
  })

  it('prefills the editor with the current payload', async () => {
    renderEdit()
    const box = (await screen.findByLabelText(/payload/i)) as HTMLTextAreaElement
    expect(box.value).toContain('"engine": "postgres"')
  })

  it('submits an UPDATE request with the edited JSON', async () => {
    renderEdit()
    const box = (await screen.findByLabelText(/payload/i)) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: '{"spec":{"size":"large"}}' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(requests.submitRequest).toHaveBeenCalledTimes(1))
    expect(requests.submitRequest).toHaveBeenCalledWith({
      action: 'UPDATE',
      resource_type: 'database',
      resource_id: 5,
      payload: { spec: { size: 'large' } },
    })
    expect(await screen.findByText(/edit request #12 submitted for approval to payments/i)).toBeInTheDocument()
  })

  it('shows an error and does not submit on invalid JSON', async () => {
    renderEdit()
    const box = (await screen.findByLabelText(/payload/i)) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: '{not json' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(await screen.findByText(/invalid json/i)).toBeInTheDocument()
    expect(requests.submitRequest).not.toHaveBeenCalled()
  })
})
