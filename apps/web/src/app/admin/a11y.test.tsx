import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as admin from '@/lib/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authValue: any
vi.mock('@/lib/auth', () => ({ useAuth: () => authValue }))
vi.mock('@/lib/admin')

import { AdminDashboard } from './shell'

const CRITICAL = new Set(['critical', 'serious'])

async function noSeriousViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    // jsdom can't compute layout; color-contrast needs a real renderer.
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations.filter((v) => CRITICAL.has(v.impact ?? ''))
}

beforeEach(() => {
  authValue = { hasRole: (r: string) => r === 'platform-admin', isLoading: false }
  vi.mocked(admin.fetchOverview).mockResolvedValue({
    requests_by_state: { PENDING_APPROVAL: 3 },
    pending_onboarding: 0,
    workflow_success_rate: 1,
    option_source_staleness: 0,
    invalid_catalog_files: 0,
  })
})

describe('admin dashboard accessibility', () => {
  it('overview route has no critical/serious axe violations', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={qc}>
        <AdminDashboard />
      </QueryClientProvider>,
    )
    await screen.findByText('Pending approval')
    const violations = await noSeriousViolations(container)
    expect(violations, JSON.stringify(violations.map((v) => v.id))).toHaveLength(0)
  })
})
