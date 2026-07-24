import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as requests from '@/lib/requests'
import { RequestForm } from './form'

vi.mock('@/lib/requests')

const schema = {
  properties: { engine: { type: 'string', title: 'Engine' } },
  required: ['engine'],
}

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RequestForm resourceType="database" resourceId={1} schema={schema} />
    </QueryClientProvider>,
  )
}

describe('RequestForm', () => {
  beforeEach(() => {
    vi.mocked(requests.submitRequest).mockResolvedValue({ id: 7, state: 'PENDING_APPROVAL' } as never)
  })

  it('blocks submit and shows an error when a required field is empty', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))
    expect(screen.getByText(/engine is required/i)).toBeInTheDocument()
    expect(requests.submitRequest).not.toHaveBeenCalled()
  })

  it('submits when the required field is filled', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('engine'), { target: { value: 'pg16' } })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))
    await waitFor(() => expect(requests.submitRequest).toHaveBeenCalledTimes(1))
    expect(requests.submitRequest).toHaveBeenCalledWith({
      action: 'UPDATE',
      resource_type: 'database',
      resource_id: 1,
      payload: { spec: { engine: 'pg16' } },
    })
    expect(await screen.findByText(/submitted/i)).toBeInTheDocument()
  })
})
