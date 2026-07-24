import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as requests from '@/lib/requests'
import * as catalog from '@/lib/catalog'
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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ApprovalQueue />
    </QueryClientProvider>,
  )
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
})
