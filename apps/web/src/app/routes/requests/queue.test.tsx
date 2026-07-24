import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test-router'
import * as requests from '@/lib/requests'
import * as catalog from '@/lib/catalog'
import { ApiError } from '@/lib/api'
import { ApprovalQueue } from './queue'

vi.mock('@/lib/requests')
vi.mock('@/lib/catalog')

function make(id: number, can_approve: boolean): requests.ChangeRequest {
  return {
    id, kind: 'RESOURCE_CHANGE', action: 'UPDATE', resource_type: 'database', resource_id: id,
    owner_team: 'payments', payload: { spec: {} }, requester: 'bob', state: 'PENDING_APPROVAL',
    approval_policy: { mode: 'SINGLE' }, approvals: [], base_git_sha: 'x', workflow_ref: null,
    created_at: null, can_approve, events: [],
  }
}

function renderQueue() {
  return renderWithRouter(<ApprovalQueue />, ['/requests/$requestId'])
}

describe('ApprovalQueue', () => {
  beforeEach(() => {
    vi.mocked(catalog.fetchResource).mockResolvedValue({ payload: { spec: {} } } as never)
  })

  it('shows approve button only for requests the caller can approve', async () => {
    vi.mocked(requests.fetchQueue).mockResolvedValue({
      items: [make(1, true), make(2, false)],
    })
    renderQueue()
    // Both rows render; only the approvable one exposes an Approve button.
    expect(await screen.findByText(/#1 UPDATE database/)).toBeInTheDocument()
    expect(screen.getByText(/#2 UPDATE database/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^approve$/i })).toHaveLength(1)
  })

  it('approves without confirm_stale, warns on 409, and only re-confirms on explicit action', async () => {
    vi.mocked(requests.fetchQueue).mockResolvedValue({ items: [make(1, true)] })
    const approve = vi
      .mocked(requests.approveRequest)
      .mockRejectedValueOnce(new ApiError(409, 'stale'))
      .mockResolvedValueOnce(make(1, true))
    renderQueue()

    fireEvent.click(await screen.findByRole('button', { name: /^approve$/i }))
    // First attempt must NOT confirm staleness.
    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1))
    expect(approve.mock.calls[0][1]).toMatchObject({ confirm_stale: false })

    // Warning appears; no second call yet.
    expect(await screen.findByText(/stale/i)).toBeInTheDocument()
    expect(approve).toHaveBeenCalledTimes(1)

    // Explicit re-confirm sends confirm_stale: true.
    fireEvent.click(screen.getByRole('button', { name: /approve anyway/i }))
    await waitFor(() => expect(approve).toHaveBeenCalledTimes(2))
    expect(approve.mock.calls[1][1]).toMatchObject({ confirm_stale: true })
  })
})
