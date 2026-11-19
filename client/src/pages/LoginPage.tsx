import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/ApiError'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { FormField } from '../components/FormField'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import type { FieldErrors } from '../types'
import { validateLogin } from '../utils/validation'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const { user, notice, login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={from} replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateLogin(values)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      await login(values.email.trim(), values.password)
      navigate(from, { replace: true })
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.')
      if (error instanceof ApiError) setErrors(error.fieldErrors)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async (credential: string) => {
    setFormError(null)
    try {
      await loginWithGoogle(credential, 'rescuer')
      navigate(from, { replace: true })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Google sign-in failed.')
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back to KaiShare.">
      {notice && <Alert kind="warning">{notice}</Alert>}
      {formError && <Alert kind="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Email" error={errors.email}>
          <input
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => setValues({ ...values, email: event.target.value })}
          />
        </FormField>
        <FormField label="Password" error={errors.password}>
          <input
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(event) => setValues({ ...values, password: event.target.value })}
          />
        </FormField>
        <button type="submit" className="button button-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <GoogleSignInButton onCredential={handleGoogle} text="signin_with" />
      <p className="muted small center">New Google accounts join as a rescuer. Donors: please register below.</p>

      <p className="center">
        New to KaiShare? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  )
}
