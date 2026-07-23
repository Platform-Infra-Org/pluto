import { InMemoryWebStorage } from 'oidc-client-ts'
import { describe, expect, it } from 'vitest'

import { userManager } from './auth'

describe('auth userStore', () => {
  it('keeps tokens in memory, never web storage (XSS-readable)', () => {
    // WebStorageStateStore wraps the real backing store on a private `_store`.
    const userStore = userManager().settings.userStore as unknown as {
      _store: unknown
    }
    expect(userStore._store).toBeInstanceOf(InMemoryWebStorage)
    expect(userStore._store).not.toBe(window.sessionStorage)
    expect(userStore._store).not.toBe(window.localStorage)
  })
})
