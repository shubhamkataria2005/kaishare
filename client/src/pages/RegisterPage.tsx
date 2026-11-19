import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/ApiError'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { FormField } from '../components/FormField'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import type { FieldErrors } from '../types'
import { validateRegister, type RegisterValues } from '../utils/validation'
import { AuthLayout } from './AuthLayout'

const EMPTY: RegisterValues = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: '',
  organisation: '',
  suburb: '',
  phone: '',
}

export function RegisterPage() {
  const { user, register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState<RegisterValues>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const set = (field: keyof RegisterValues) => (event: { target: { value: string } }) =>
    setValues((previous) => ({ ...previous, [field]: event.target.value }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateRegister(values)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      await register({
        ...values,
        role: values.role as 'donor' | 'rescuer',
        name: values.name.trim(),
        email: values.email.trim(),
      })
      navigate(values.role === 'donor' ? '/listings/new' : '/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors)
        setFormError(error.message)
      } else {
        setFormError('Registration failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async (credential: string) => {
    if (!values.role) {
      setErrors({ role: 'Choose whether you are a donor or a rescuer first.' })
      return
    }
    try {
      await loginWithGoogle(credential, values.role)
      navigate('/', { replace: true })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Google sign-in failed.')
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Join the network rescuing surplus food in Auckland.">
      {formError && <Alert kind="error">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate>
        <fieldset className={`role-picker${errors.role ? ' field-invalid' : ''}`}>
          <legend>I am a…</legend>
          <label className={values.role === 'donor' ? 'role-option selected' : 'role-option'}>
            <input type="radio" name="role" value="donor" checked={values.role === 'donor'} onChange={set('role')} />
            <span className="role-title">🥖 Donor</span>
            <span className="small muted">Café, bakery, grocer or caterer with surplus food</span>
          </label>
          <label className={values.role === 'rescuer' ? 'role-option selected' : 'role-option'}>
            <input type="radio" name="role" value="rescuer" checked={values.role === 'rescuer'} onChange={set('role')} />
            <span className="role-title">🚐 Rescuer</span>
            <span className="small muted">Food bank, charity or volunteer who collects food</span>
          </label>
          {errors.role && <small className="field-error">{errors.role}</small>}
        </fieldset>

        <div className="grid-2">
          <FormField label="Full name" error={errors.name}>
            <input autoComplete="name" value={values.name} onChange={set('name')} />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <input type="email" autoComplete="email" value={values.email} onChange={set('email')} />
          </FormField>
          <FormField label="Organisation (optional)" error={errors.organisation}>
            <input autoComplete="organization" value={values.organisation} onChange={set('organisation')} />
          </FormField>
          <FormField label="Suburb (optional)" error={errors.suburb}>
            <input value={values.suburb} onChange={set('suburb')} />
          </FormField>
          <FormField label="Phone (optional)" error={errors.phone}>
            <input type="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} placeholder="021 123 4567" />
          </FormField>
          <span />
          <FormField label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
            <input type="password" autoComplete="new-password" value={values.password} onChange={set('password')} />
          </FormField>
          <FormField label="Confirm password" error={errors.confirmPassword}>
            <input type="password" autoComplete="new-password" value={values.confirmPassword} onChange={set('confirmPassword')} />
          </FormField>
        </div>

        <button type="submit" className="button button-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <GoogleSignInButton onCredential={handleGoogle} text="signup_with" />

      <p className="center">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
