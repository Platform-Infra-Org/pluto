import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthContext, type AuthState } from '@/lib/auth'
import { BuilderCanvas } from './canvas'

function renderWithRole(roles: string[]) {
  const auth: AuthState = {
    principal: { sub: 'u', username: 'u', groups: [], roles, teams: ['payments'] },
    isLoading: false,
    hasRole: (r) => roles.includes(r),
    refresh: async () => {},
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <BuilderCanvas />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('BuilderCanvas access + editing', () => {
  it('is service-owner-only (display gate)', () => {
    renderWithRole(['requester'])
    expect(screen.getByText(/service owner access required/i)).toBeInTheDocument()
    expect(screen.queryByText('Service Builder')).not.toBeInTheDocument()
  })

  it('lets a service owner add a field and see it in the live preview', () => {
    renderWithRole(['service-owner'])
    expect(screen.getByText('Service Builder')).toBeInTheDocument()
    fireEvent.click(screen.getByText('+ add field'))
    fireEvent.change(screen.getByLabelText('field key'), { target: { value: 'engine' } })
    // The new key appears as a preview input (rendered by the shared SchemaForm).
    expect(screen.getByLabelText('engine')).toBeInTheDocument()
  })
})
