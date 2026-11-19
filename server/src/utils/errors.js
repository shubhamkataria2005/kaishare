/**
 * Error types the services throw. The error-handling middleware turns each
 * one into an HTTP response with the matching status code, so services never
 * deal with `res` directly and can be tested without Express.
 */

export class AppError extends Error {
  /**
   * @param {string} message message that is safe to show to the user
   * @param {number} status HTTP status code
   * @param {Record<string, string>} [fieldErrors] per-field validation messages
   */
  constructor(message, status = 500, fieldErrors = undefined) {
    super(message)
    this.name = this.constructor.name
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Please correct the highlighted fields.', fieldErrors = {}) {
    super(message, 400, fieldErrors)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Please sign in to continue.') {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do that.') {
    super(message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested item was not found.') {
    super(message, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409)
  }
}
