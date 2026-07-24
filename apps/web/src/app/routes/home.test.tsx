import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test-router'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authValue: any
vi.mock('@/lib/auth', () => ({
  useAuth: () => authValue,
  login: vi.fn(),
  logout: vi.fn(),
}))

import { HomePage } from './home'

const LINK_PATHS = ['/resources', '/requests', '/requests/queue', '/builder', '/requests/new']

describe('HomePage', () => {
  beforeEach(() => {
    authValue = {
      principal: { sub: 'u1', username: 'u1', groups: [], roles: ['requester'], teams: ['payments'] },
      isLoading: false,
      hasRole: (r: string) => r === 'requester',
      refresh: vi.fn(),
    }
  })

  it('renders the Platform heading', async () => {
    renderWithRouter(<HomePage />, LINK_PATHS)
    expect(await screen.findByRole('heading', { name: 'Platform' })).toBeInTheDocument()
  })

  it('shows clickable section cards and a New request CTA when logged in', async () => {
    renderWithRouter(<HomePage />, LINK_PATHS)
    // Feature cards are links now.
    expect(await screen.findByRole('link', { name: /Resources/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /My Requests/ })).toBeInTheDocument()
    // A team member can approve → Approvals card shows; not a service-owner → no Builder card.
    expect(screen.getByRole('link', { name: /Approvals/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Service Builder/ })).not.toBeInTheDocument()
    // Primary CTA.
    expect(screen.getByRole('link', { name: /New request/ })).toBeInTheDocument()
  })

  it('shows nothing but the intro when logged out', async () => {
    authValue = { principal: null, isLoading: false, hasRole: () => false, refresh: vi.fn() }
    renderWithRouter(<HomePage />, LINK_PATHS)
    expect(await screen.findByRole('heading', { name: 'Platform' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /New request/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Resources/ })).not.toBeInTheDocument()
  })
})
