import type { AuthResponse, User } from '../types'
import { http } from './httpClient'

export interface AuthProviders {
  local: boolean
  google: { enabled: boolean; clientId: string | null }
}

export interface RegisterInput {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: 'donor' | 'rescuer'
  organisation?: string
  suburb?: string
  phone?: string
}

export const authApi = {
  providers: () => http.get<AuthProviders>('/auth/providers', { auth: false }),
  register: (input: RegisterInput) => http.post<AuthResponse>('/auth/register', input, { auth: false }),
  login: (email: string, password: string) => http.post<AuthResponse>('/auth/login', { email, password }, { auth: false }),
  google: (credential: string, role: 'donor' | 'rescuer') =>
    http.post<AuthResponse>('/auth/google', { credential, role }, { auth: false }),
  refresh: () => http.post<AuthResponse>('/auth/refresh', undefined, { auth: false }),
  logout: () => http.post<void>('/auth/logout', undefined, { auth: false }),
  me: () => http.get<{ user: User }>('/auth/me'),
  updateMe: (changes: Partial<Pick<User, 'name' | 'organisation' | 'suburb' | 'phone'>>) =>
    http.patch<{ user: User }>('/auth/me', changes),
}
