/**
 * Route guard. Sends signed-out users to the login page (remembering where
 * they were going) and shows "not allowed" when the user's role cannot use
 * the page. The API enforces the same rules; this only keeps the UI tidy.
 */
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '../components/Spinner'
import type { Role } from '../types'
import { useAuth } from './useAuth'

interface Props {
  children: ReactNode
  roles?: Role[]
}

export function RequireAuth({ children, roles }: Props) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Spinner label="Checking your session…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (roles && !roles.includes(user.role)) {
    return (
      <section className="card narrow" role="alert">
        <h1>Not available for your account</h1>
        <p className="muted">This page is for {roles.join(' and ')} accounts.</p>
      </section>
    )
  }
  return <>{children}</>
}
