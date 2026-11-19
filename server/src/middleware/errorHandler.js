/**
 * Turns every error into a JSON response.
 *
 * - AppError subclasses (thrown on purpose by services) keep their status
 *   and message.
 * - Known library errors (bad JSON, duplicate key, Mongoose validation) are
 *   mapped to 400/409 with a friendly message.
 * - Anything else is a bug: it is logged with its stack trace, and the
 *   client only gets a generic message plus the request id. Internal
 *   details (stack traces, queries) are never sent to the browser.
 */
import mongoose from 'mongoose'
import { AppError } from '../utils/errors.js'

/** @param {import('winston').Logger} logger */
export function errorHandler(logger) {
  // Express recognises error handlers by their four parameters.
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, _next) => {
    if (error instanceof AppError) {
      return res.status(error.status).json({ message: error.message, errors: error.fieldErrors })
    }

    // express.json() could not parse the body.
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'Request body is not valid JSON.' })
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ message: 'Request body is too large.' })
    }

    // Unique index violation, e.g. an email that is already registered.
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern ?? {})[0] ?? 'value'
      return res.status(409).json({ message: `That ${field} is already in use.`, errors: { [field]: 'Already in use.' } })
    }

    if (error instanceof mongoose.Error.ValidationError) {
      const errors = Object.fromEntries(Object.entries(error.errors).map(([field, err]) => [field, err.message]))
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors })
    }

    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${error.message}`, {
      requestId: req.id,
      stack: error.stack,
    })
    res.status(500).json({ message: 'Something went wrong on our side. Please try again.', requestId: req.id })
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `No API route for ${req.method} ${req.path}.` })
}
