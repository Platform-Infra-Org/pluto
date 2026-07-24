import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test-router'
import * as catalog from '@/lib/catalog'
import * as requests from '@/lib/requests'
import { ResourceDetail } from './detail'

vi.mock('@/lib/catalog')
vi.mock('@/lib/requests')

const resource = {
  id: 5,
  type: 'database',
  name: 'orders-db',
  owner_team: 'payments',
  git_path: 'x',
  git_sha: 'abcdef1234',
  status: 'active',
  updated_at: null,
  payload: { spec: { engine: 'postgres' } },
}

function renderDetail() {
  return renderWithRouter(<ResourceDetail id={5} />, ['/resources/$resourceId/edit'])
}

describe('ResourceDetail actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(catalog.fetchResource).mockResolvedValue(resource as never)
    vi.mocked(catalog.fetchHistory).mockResolvedValue([] as never)
    vi.mocked(requests.submitRequest).mockResolvedValue({ id: 21, state: 'PENDING_APPROVAL', owner_team: 'payments' } as never)
  })

  it('links Edit to the edit route', async () => {
    renderDetail()
    const edit = (await screen.findByRole('link', { name: /edit/i })) as HTMLAnchorElement
    expect(edit.getAttribute('href')).toContain('/resources/5/edit')
  })

  it('submits a DELETE request after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }))
    await waitFor(() => expect(requests.submitRequest).toHaveBeenCalledTimes(1))
    expect(requests.submitRequest).toHaveBeenCalledWith({
      action: 'DELETE',
      resource_type: 'database',
      resource_id: 5,
      payload: {},
    })
    expect(await screen.findByText(/#21/)).toBeInTheDocument()
  })

  it('does not submit DELETE when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }))
    expect(requests.submitRequest).not.toHaveBeenCalled()
  })
})
