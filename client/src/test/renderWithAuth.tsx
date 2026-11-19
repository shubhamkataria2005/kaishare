/** Renders a component inside a router, toasts and a fake auth context. */
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../auth/AuthContext'
import { ToastProvider } from '../components/toast/ToastProvider'
import type { User } from '../types'

export const testUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'Tama Wiremu',
  email: 'tama@example.com',
  role: 'rescuer',
  authProvider: 'local',
  organisation: 'Kai Collective',
  suburb: 'Mt Eden',
  phone: '',
  createdAt: '2026-11-01T00:00:00Z',
  ...overrides,
})

export function fakeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'authenticated',
    user: testUser(),
    notice: null,
    login: vi.fn(),
    register: vi.fn(),
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    ...overrides,
  }
}

export function renderWithAuth(ui: ReactElement, { auth = fakeAuth(), path = '/', route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <AuthContext.Provider value={auth}>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="/login" element={<p>Login page</p>} />
            <Route path="*" element={<p>Somewhere else</p>} />
          </Routes>
        </AuthContext.Provider>
      </ToastProvider>
    </MemoryRouter>,
  )
}
