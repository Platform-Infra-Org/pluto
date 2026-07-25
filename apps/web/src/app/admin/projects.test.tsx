import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as admin from '@/lib/admin'

vi.mock('@/lib/admin')

import { AdminProjects } from './projects'

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AdminProjects />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(admin.fetchProjects).mockResolvedValue({
    items: [{ id: 1, name: 'proj-x', group_name: 'team-a', description: null }],
  })
  vi.mocked(admin.fetchGroups).mockResolvedValue({
    items: [{ id: 1, name: 'team-a', source: 'import', description: null }],
  })
  vi.mocked(admin.createProject).mockResolvedValue({
    id: 2,
    name: 'proj-y',
    group_name: 'team-a',
    description: null,
    group_known: true,
  })
})

describe('AdminProjects', () => {
  it('lists projects with their mapped group', async () => {
    renderPanel()
    expect(await screen.findByText('proj-x')).toBeInTheDocument()
    expect(screen.getByText('team-a')).toBeInTheDocument()
  })

  it('creates a project posting name + group_name', async () => {
    renderPanel()
    await screen.findByText('proj-x')
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'proj-y' } })
    // input with a `list` datalist has role combobox, not textbox
    fireEvent.change(screen.getByRole('combobox', { name: 'Group' }), { target: { value: 'team-a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(admin.createProject).toHaveBeenCalledWith({
        name: 'proj-y',
        group_name: 'team-a',
        description: undefined,
      }),
    )
  })
})
