import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/ApiError'
import { authApi } from '../api/authApi'
import { fakeAuth, renderWithAuth } from '../test/renderWithAuth'
import { LoginPage } from './LoginPage'

beforeEach(() => {
  // Google sign-in is switched off for these tests.
  vi.spyOn(authApi, 'providers').mockResolvedValue({ local: true, google: { enabled: false, clientId: null } })
})

const signedOut = (overrides = {}) => fakeAuth({ status: 'anonymous', user: null, ...overrides })

describe('LoginPage', () => {
  it('shows validation errors and does not call the API for empty fields', async () => {
    const auth = signedOut()
    renderWithAuth(<LoginPage />, { auth, path: '/login', route: '/login' })

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('signs in with the trimmed email', async () => {
    const auth = signedOut({ login: vi.fn().mockResolvedValue(undefined) })
    renderWithAuth(<LoginPage />, { auth, path: '/login', route: '/login' })

    await userEvent.type(screen.getByLabelText('Email'), '  tama@example.com ')
    await userEvent.type(screen.getByLabelText('Password'), 'Kai2026share')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(auth.login).toHaveBeenCalledWith('tama@example.com', 'Kai2026share')
  })

  it('shows the server message when the password is wrong', async () => {
    const auth = signedOut({ login: vi.fn().mockRejectedValue(new ApiError('Email or password is incorrect.', 401)) })
    renderWithAuth(<LoginPage />, { auth, path: '/login', route: '/login' })

    await userEvent.type(screen.getByLabelText('Email'), 'tama@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
  })

  it('shows the "session ended" notice', () => {
    renderWithAuth(<LoginPage />, { auth: signedOut({ notice: 'Your session has ended. Please sign in again.' }), path: '/login', route: '/login' })
    expect(screen.getByText('Your session has ended. Please sign in again.')).toBeInTheDocument()
  })
})
