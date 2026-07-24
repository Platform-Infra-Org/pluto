import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const completeLogin = vi.fn().mockResolvedValue(undefined)
const refresh = vi.fn().mockResolvedValue(undefined)
const navigate = vi.fn()

vi.mock('../../lib/auth', () => ({
  completeLogin: () => completeLogin(),
  useAuth: () => ({ refresh }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

import { AuthCallback } from './auth-callback'

describe('AuthCallback', () => {
  it('completes the login then navigates home', async () => {
    render(<AuthCallback />)
    await waitFor(() => expect(completeLogin).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/' }))
  })
})
