import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const login = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authValue: any

vi.mock('../lib/auth', () => ({
  useAuth: () => authValue,
  login: () => login(),
}))

import { RequireAuth, RoleGate } from './guard'

describe('RequireAuth', () => {
  beforeEach(() => login.mockClear())

  it('redirects unauthenticated users to login and hides content', async () => {
    authValue = { principal: null, isLoading: false, hasRole: () => false }
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders children for authenticated users', () => {
    authValue = {
      principal: { roles: ['requester'] },
      isLoading: false,
      hasRole: (r: string) => r === 'requester',
    }
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })
})

describe('RoleGate (display-only gating)', () => {
  it('hides admin-only UI from a requester', () => {
    authValue = {
      principal: { roles: ['requester'] },
      isLoading: false,
      hasRole: (r: string) => r === 'requester',
    }
    render(
      <RoleGate role="platform-admin">
        <button>Delete everything</button>
      </RoleGate>,
    )
    expect(
      screen.queryByRole('button', { name: 'Delete everything' }),
    ).not.toBeInTheDocument()
  })

  it('shows admin-only UI to an admin', () => {
    authValue = {
      principal: { roles: ['platform-admin'] },
      isLoading: false,
      hasRole: (r: string) => r === 'platform-admin',
    }
    render(
      <RoleGate role="platform-admin">
        <button>Delete everything</button>
      </RoleGate>,
    )
    expect(
      screen.getByRole('button', { name: 'Delete everything' }),
    ).toBeInTheDocument()
  })
})
