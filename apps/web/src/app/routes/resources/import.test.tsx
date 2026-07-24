import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as catalog from '@/lib/catalog'
import * as services from '@/lib/services'
import * as requests from '@/lib/requests'
import { ImportEntity } from './import'

vi.mock('@/lib/catalog')
vi.mock('@/lib/services')
vi.mock('@/lib/requests')

function jsonFile(content: string) {
  return new File([content], 'entity.json', { type: 'application/json' })
}

function renderImport() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ImportEntity />
    </QueryClientProvider>,
  )
}

describe('ImportEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(catalog.fetchResources).mockResolvedValue({ items: [], page: 1 } as never)
    vi.mocked(services.fetchAvailableTypes).mockResolvedValue({
      items: [{ name: 'database', category: 'data', owner_team: 'payments' }],
    } as never)
    vi.mocked(requests.submitRequest).mockResolvedValue({ id: 99, state: 'PENDING_APPROVAL', owner_team: 'payments' } as never)
  })

  it('parses the uploaded JSON, picks a type, and submits a CREATE', async () => {
    renderImport()
    await screen.findByRole('option', { name: 'database' })
    const type = screen.getByLabelText(/type/i) as HTMLSelectElement
    fireEvent.change(type, { target: { value: 'database' } })
    fireEvent.change(screen.getByLabelText(/file/i), {
      target: { files: [jsonFile('{"payload":{"a":1},"mapping":{"children":{},"internals":{}}}')] },
    })
    fireEvent.click(await screen.findByRole('button', { name: /import/i }))
    await waitFor(() => expect(requests.submitRequest).toHaveBeenCalledTimes(1))
    expect(requests.submitRequest).toHaveBeenCalledWith({
      action: 'CREATE',
      resource_type: 'database',
      resource_id: null,
      payload: { payload: { a: 1 }, mapping: { children: {}, internals: {} } },
    })
    expect(await screen.findByText(/#99/)).toBeInTheDocument()
  })

  it('shows an error for an invalid JSON file', async () => {
    renderImport()
    fireEvent.change(await screen.findByLabelText(/file/i), {
      target: { files: [jsonFile('{not valid')] },
    })
    expect(await screen.findByText(/invalid json/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /import/i }))
    expect(requests.submitRequest).not.toHaveBeenCalled()
  })
})
