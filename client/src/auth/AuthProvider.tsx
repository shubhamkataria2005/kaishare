/**
 * Holds the signed-in user for the whole app.
 *
 * On start-up it asks the API for a new access token using the httpOnly
 * refresh cookie. If the API cannot be reached it opens in offline mode
 * with the last user's cached data; when the connection returns it tries
 * again and sends any changes queued in the outbox.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../api/ApiError'
import { authApi, type RegisterInput } from '../api/authApi'
import { http } from '../api/httpClient'
import { tokenStore } from '../api/tokenStore'
import { clearUserData, loadLastUser, saveLastUser } from '../offline/offlineCache'
import { disablePushForThisDevice } from '../pwa/pushSubscription'
import type { AuthResponse, User } from '../types'
import { createLogger } from '../utils/logger'
import { AuthContext, SESSION_EXPIRED_NOTICE, type AuthContextValue, type AuthStatus } from './AuthContext'
import { refreshSession } from './session'

const log = createLogger('auth')

// Refresh the access token one minute before it expires.
const REFRESH_EARLY_MS = 60 * 1000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const userRef = useRef<User | null>(null)
  useEffect(() => {
    userRef.current = user
  }, [user])

  const applySession = useCallback((response: AuthResponse) => {
    tokenStore.set(response.accessToken, response.accessTokenExpiresAt)
    setUser(response.user)
    setStatus('authenticated')
    setNotice(null)
    saveLastUser(response.user).catch((error) => log.warn('Could not save the profile for offline use', error))
  }, [])

  const endSession = useCallback(async (message?: string) => {
    const previous = userRef.current
    tokenStore.clear()
    setUser(null)
    setStatus('anonymous')
    setNotice(message ?? null)
    // Remove this user's cached data so the next person on this device cannot see it.
    if (previous) await clearUserData(previous.id).catch(() => undefined)
  }, [])

  /**
   * The session could not be restored. Without a connection, open in
   * offline mode with the last user's cached data; otherwise sign out.
   */
  const handleRestoreFailure = useCallback(async (error: unknown) => {
    if (error instanceof ApiError && error.isNetworkError) {
      const last = await loadLastUser().catch(() => undefined)
      if (last) {
        log.info('No connection: opening in offline mode')
        setUser(last.user)
        setStatus('offline')
        return
      }
    }
    setStatus('anonymous')
  }, [])

  const restore = useCallback(
    () =>
      refreshSession()
        .then((response) => {
          applySession(response)
          log.info('Session restored')
        })
        .catch(handleRestoreFailure),
    [applySession, handleRestoreFailure],
  )

  // Check for an existing session once, when the app starts.
  useEffect(() => {
    void restore()
  }, [restore])

  // Let the HTTP client refresh tokens and report an ended session.
  useEffect(() => {
    http.setAuthHooks({
      refresh: async () => {
        try {
          const response = await refreshSession()
          setUser(response.user)
          return response.accessToken
        } catch {
          return null
        }
      },
      onSessionExpired: () => void endSession(SESSION_EXPIRED_NOTICE),
    })
    return () => http.setAuthHooks(null)
  }, [endSession])

  // Back online after starting offline: restore the session properly.
  useEffect(() => {
    if (status !== 'offline') return
    const handleOnline = () => void restore()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [status, restore])

  // Refresh shortly before the access token expires.
  useEffect(() => {
    if (status !== 'authenticated') return
    const delay = Math.max(5_000, tokenStore.msUntilExpiry() - REFRESH_EARLY_MS)
    const timer = setTimeout(() => {
      refreshSession()
        .then(applySession)
        .catch((error) => {
          if (!(error instanceof ApiError && error.isNetworkError)) void endSession(SESSION_EXPIRED_NOTICE)
        })
    }, delay)
    return () => clearTimeout(timer)
  }, [status, user, applySession, endSession])

  const login = useCallback(
    async (email: string, password: string) => applySession(await authApi.login(email, password)),
    [applySession],
  )

  const register = useCallback(async (input: RegisterInput) => applySession(await authApi.register(input)), [applySession])

  const loginWithGoogle = useCallback(
    async (credential: string, role: 'donor' | 'rescuer') => applySession(await authApi.google(credential, role)),
    [applySession],
  )

  const logout = useCallback(
    async (message?: string) => {
      // Stop push messages for this user on this (possibly shared) device.
      await disablePushForThisDevice().catch(() => undefined)
      await authApi.logout().catch(() => undefined)
      await endSession(message)
    },
    [endSession],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, notice, login, register, loginWithGoogle, logout, updateUser: setUser }),
    [status, user, notice, login, register, loginWithGoogle, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
