import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authValue: any
vi.mock('@/lib/auth', () => ({
  useAuth: () => authValue,
  login: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('./notifications/useNotifications', () => ({
  useNotifications: () => ({ items: [], unread: 0, markAllRead: vi.fn() }),
}))

import { NavBar } from './nav'

// Every path NavBar links to needs a matching route so the test router can
// resolve them — mirrors the flat, absolute-path shape of the real router.
function renderNav() {
  const rootRoute = createRootRoute({ component: NavBar })
  const paths = ['/', '/resources', '/requests', '/requests/queue', '/builder', '/admin']
  const routeTree = rootRoute.addChildren(
    paths.map((path) => createRoute({ getParentRoute: () => rootRoute, path, component: () => null })),
  )
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) })
  return render(<RouterProvider router={router} />)
}

function principal(roles: string[], teams: string[] = []) {
  return { sub: 'u1', username: 'u1', groups: [], roles, teams }
}

describe('NavBar', () => {
  beforeEach(() => {
    authValue = { principal: null, isLoading: false, hasRole: () => false, refresh: vi.fn() }
  })

  it('shows only brand + Login when logged out', async () => {
    renderNav()
    expect(await screen.findByRole('link', { name: 'Platform' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
    for (const name of ['Resources', 'My Requests', 'Approvals', 'Service Builder', 'Admin']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
  })

  it('shows Approvals for an owner-team member but not Service Builder or Admin', async () => {
    authValue = {
      principal: principal(['requester'], ['payments']),
      isLoading: false,
      hasRole: (r: string) => r === 'requester',
      refresh: vi.fn(),
    }
    renderNav()
    expect(await screen.findByRole('link', { name: 'Resources' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Requests' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Approvals' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Service Builder' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('shows Service Builder for a service-owner', async () => {
    authValue = {
      principal: principal(['service-owner']),
      isLoading: false,
      hasRole: (r: string) => r === 'service-owner',
      refresh: vi.fn(),
    }
    renderNav()
    expect(await screen.findByRole('link', { name: 'Service Builder' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Approvals' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('shows Admin and Approvals for a platform-admin, with aria-current on the active link', async () => {
    authValue = {
      principal: principal(['platform-admin']),
      isLoading: false,
      hasRole: (r: string) => r === 'platform-admin',
      refresh: vi.fn(),
    }
    renderNav()
    expect(await screen.findByRole('link', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Approvals' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Platform' })).toHaveAttribute('aria-current', 'page')
  })
})
