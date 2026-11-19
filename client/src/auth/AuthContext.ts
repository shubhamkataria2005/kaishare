import { createContext } from 'react'
import type { RegisterInput } from '../api/authApi'
import type { User } from '../types'

/**
 * - loading:       checking for an existing session on start-up
 * - authenticated: signed in and online
 * - offline:       no connection; showing the last signed-in user's cached
 *                  data, and queueing changes until the connection returns
 * - anonymous:     signed out
 */
export type AuthStatus = 'loading' | 'authenticated' | 'offline' | 'anonymous'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  /** Message for the login page, e.g. "Your session has expired." */
  notice: string | null
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  loginWithGoogle: (credential: string, role: 'donor' | 'rescuer') => Promise<void>
  logout: (notice?: string) => Promise<void>
  updateUser: (user: User) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const SESSION_EXPIRED_NOTICE = 'Your session has ended. Please sign in again.'
