import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { completeLogin, useAuth } from '../../lib/auth'

// Finishes the PKCE redirect, reloads the principal, then returns home.
export function AuthCallback() {
  const navigate = useNavigate()
  const { refresh } = useAuth()

  useEffect(() => {
    completeLogin()
      .then(refresh)
      .catch(() => {})
      .finally(() => navigate({ to: '/' }))
  }, [navigate, refresh])

  return <div>Signing in…</div>
}
