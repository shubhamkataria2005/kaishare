/**
 * A labelled form control with its error message. The error is linked to
 * the input with aria-describedby and aria-invalid, so screen readers
 * announce it.
 */
import { useId, type ReactElement, type ReactNode } from 'react'
import { cloneElement } from 'react'

interface Props {
  label: string
  error?: string
  hint?: ReactNode
  /** A single <input>, <select> or <textarea>. */
  children: ReactElement<Record<string, unknown>>
}

export function FormField({ label, error, hint, children }: Props) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <small id={hintId} className="field-hint">
          {hint}
        </small>
      )}
      {error && (
        <small id={errorId} className="field-error">
          {error}
        </small>
      )}
    </div>
  )
}
