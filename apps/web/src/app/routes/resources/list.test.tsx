import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as catalog from '@/lib/catalog'
import { ResourceList } from './list'

vi.mock('@/lib/catalog')

const items = [
  { id: 1, name: 'orders-db', type: 'database', owner_team: 'payments', git_path: 'x', git_sha: 'a1', status: 'active', updated_at: null },
  { id: 2, name: 'sessions', type: 'cache', owner_team: 'search', git_path: 'y', git_sha: 'b2', status: 'active', updated_at: null },
]

beforeEach(() => {
  vi.mocked(catalog.fetchResources).mockResolvedValue({ items, page: 1 })
})

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ResourceList />
    </QueryClientProvider>,
  )
}

describe('ResourceList', () => {
  it('renders a row per resource', async () => {
    renderList()
    expect(await screen.findByText('orders-db')).toBeInTheDocument()
    expect(screen.getByText('sessions')).toBeInTheDocument()
  })

  it('filter narrows the visible rows', async () => {
    renderList()
    await screen.findByText('orders-db')
    fireEvent.change(screen.getByPlaceholderText(/filter/i), { target: { value: 'orders' } })
    await waitFor(() => expect(screen.queryByText('sessions')).not.toBeInTheDocument())
    expect(screen.getByText('orders-db')).toBeInTheDocument()
  })
})
