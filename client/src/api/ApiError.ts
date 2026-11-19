import type { FieldErrors } from '../types'

/** An error the UI can show: a message, the HTTP status and any field errors. */
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(message: string, status: number, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }

  /** True when no response arrived at all (offline, server down, DNS...). */
  get isNetworkError(): boolean {
    return this.status === 0
  }
}
