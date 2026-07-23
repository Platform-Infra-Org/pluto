// In-memory access-token holder. Separate module so api.ts and auth.ts share it
// without a circular import.
let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}
