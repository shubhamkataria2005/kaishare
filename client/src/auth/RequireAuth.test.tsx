import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeAuth, renderWithAuth, testUser } from '../test/renderWithAuth'
import { RequireAuth } from './RequireAuth'

const page = (roles?: ('donor' | 'rescuer' | 'admin')[]) => (
  <RequireAuth roles={roles}>
    <p>Secret page</p>
  </RequireAuth>
)

describe('RequireAuth', () => {
  it('shows the page to a signed-in user', () => {
    renderWithAuth(page())
    expect(screen.getByText('Secret page')).toBeInTheDocument()
  })

  it('sends a signed-out user to the login page', () => {
    renderWithAuth(page(), { auth: fakeAuth({ status: 'anonymous', user: null }) })
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Secret page')).not.toBeInTheDocument()
  })

  it('waits while the session is being checked', () => {
    renderWithAuth(page(), { auth: fakeAuth({ status: 'loading', user: null }) })
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
  })

  it('blocks a role that may not use the page', () => {
    renderWithAuth(page(['donor']), { auth: fakeAuth({ user: testUser({ role: 'rescuer' }) }) })
    expect(screen.getByRole('alert')).toHaveTextContent('Not available for your account')
  })

  it('lets an offline user see cached pages', () => {
    renderWithAuth(page(), { auth: fakeAuth({ status: 'offline' }) })
    expect(screen.getByText('Secret page')).toBeInTheDocument()
  })
})
