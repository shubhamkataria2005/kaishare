/**
 * Refreshes the session with the httpOnly refresh cookie.
 *
 * Refresh tokens are single-use (the server rotates them and treats reuse
 * as theft). If two parts of the app refreshed at the same time, the
 * second request would reuse the old token and sign the user out. So all
 * callers share one in-flight request.
 */
import { authApi } from '../api/authApi'
import { tokenStore } from '../api/tokenStore'
import type { AuthResponse } from '../types'

let inFlight: Promise<AuthResponse> | null = null

export function refreshSession(): Promise<AuthResponse> {
  inFlight ??= authApi
    .refresh()
    .then((response) => {
      tokenStore.set(response.accessToken, response.accessTokenExpiresAt)
      return response
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}
