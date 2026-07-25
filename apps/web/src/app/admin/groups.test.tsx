import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as admin from '@/lib/admin'

vi.mock('@/lib/admin')

import { AdminGroups } from './groups'

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AdminGroups />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(admin.fetchGroups).mockResolvedValue({
    items: [{ id: 1, name: 'team-a', source: 'import', description: 'A' }],
  })
  vi.mocked(admin.importGroups).mockResolvedValue({ imported: 2, skipped: 1 })
})

describe('AdminGroups', () => {
  it('lists groups from the registry', async () => {
    renderPanel()
    expect(await screen.findByText('team-a')).toBeInTheDocument()
  })

  it('imports pasted JSON and shows the summary', async () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText('Groups to import'), {
      target: { value: '["x", "y"]' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(admin.importGroups).toHaveBeenCalledWith('["x", "y"]', 'json'))
    expect(await screen.findByRole('status')).toHaveTextContent('Imported 2, skipped 1.')
  })

  it('imports as CSV when the format is switched', async () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText('Import format'), { target: { value: 'csv' } })
    fireEvent.change(screen.getByLabelText('Groups to import'), {
      target: { value: 'name\nx' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(admin.importGroups).toHaveBeenCalledWith('name\nx', 'csv'))
  })
})
