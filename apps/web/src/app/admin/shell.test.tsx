import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as admin from '@/lib/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authValue: any
vi.mock('@/lib/auth', () => ({ useAuth: () => authValue }))
vi.mock('@/lib/admin')

import { AdminDashboard } from './shell'

function renderDash() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AdminDashboard />
    </QueryClientProvider>,
  )
}

const OVERVIEW = {
  requests_by_state: { PENDING_APPROVAL: 3, SUCCEEDED: 1 },
  pending_onboarding: 2,
  workflow_success_rate: 0.5,
  option_source_staleness: 1,
  invalid_catalog_files: 0,
}

beforeEach(() => {
  vi.mocked(admin.fetchOverview).mockResolvedValue(OVERVIEW)
  vi.mocked(admin.fetchAdminServices).mockResolvedValue({
    definitions: [],
    onboarding_queue: [
      {
        id: 7, kind: 'SERVICE_ONBOARDING', action: 'CREATE', resource_type: 'svc',
        owner_team: 'payments', requester: 'eve', state: 'PENDING_APPROVAL',
        workflow_ref: null, failure: null, created_at: null,
      },
    ],
  })
  vi.mocked(admin.approveOnboarding).mockResolvedValue({ state: 'APPROVED', definition_status: 'ACTIVE' })
})

describe('AdminDashboard', () => {
  it('hides the dashboard from a non-admin', () => {
    authValue = { hasRole: () => false, isLoading: false }
    renderDash()
    expect(screen.getByRole('alert')).toHaveTextContent(/platform-admin/i)
    expect(screen.queryByRole('navigation', { name: /admin sections/i })).not.toBeInTheDocument()
  })

  it('renders overview tiles for an admin', async () => {
    authValue = { hasRole: (r: string) => r === 'platform-admin', isLoading: false }
    renderDash()
    expect(await screen.findByText('Pending approval')).toBeInTheDocument()
    // pending_approval tile value
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('approves onboarding from the services panel', async () => {
    authValue = { hasRole: (r: string) => r === 'platform-admin', isLoading: false }
    renderDash()
    fireEvent.click(screen.getByRole('button', { name: 'Services' }))
    const approve = await screen.findByRole('button', { name: 'Approve' })
    fireEvent.click(approve)
    await waitFor(() => expect(admin.approveOnboarding).toHaveBeenCalledWith(7, ''))
  })
})
