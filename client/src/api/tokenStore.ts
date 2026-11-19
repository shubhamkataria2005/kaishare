/**
 * Holds the access token in memory only.
 *
 * The token is deliberately not saved in localStorage or sessionStorage:
 * any script running on the page (for example through an XSS bug) can read
 * those. Losing the token on reload is fine, because the httpOnly refresh
 * cookie gets a new one (see refreshSession in authApi.ts).
 */
let accessToken: string | null = null
let expiresAt = 0

export const tokenStore = {
  get(): string | null {
    return accessToken && Date.now() < expiresAt ? accessToken : null
  },
  set(token: string, expiry: string | Date) {
    accessToken = token
    expiresAt = new Date(expiry).getTime()
  },
  clear() {
    accessToken = null
    expiresAt = 0
  },
  /** Milliseconds until the token expires (0 when there is none). */
  msUntilExpiry(): number {
    return accessToken ? Math.max(0, expiresAt - Date.now()) : 0
  },
}
