/**
 * Security middleware applied to every request.
 */
import rateLimit from 'express-rate-limit'

/**
 * Removes keys that start with "$" or contain "." from the request body,
 * at any depth. These are MongoDB operator/path keys (e.g. { "$gt": "" })
 * and are never valid in KaiShare input, so stripping them is a second
 * line of defence against NoSQL injection, behind Zod validation and
 * Mongoose's sanitizeFilter.
 *
 * Only the body is changed: Express 5 makes req.query read-only, and query
 * strings are validated into plain strings/numbers by Zod anyway.
 *
 * @returns {string[]} the keys that were removed (for logging)
 */
export function stripMongoOperators(value, removed = [], path = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => stripMongoOperators(item, removed, `${path}[${index}]`))
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      const keyPath = path ? `${path}.${key}` : key
      if (key.startsWith('$') || key.includes('.')) {
        delete value[key]
        removed.push(keyPath)
      } else {
        stripMongoOperators(value[key], removed, keyPath)
      }
    }
  }
  return removed
}

/** @param {import('winston').Logger} logger */
export function sanitizeBody(logger) {
  return (req, _res, next) => {
    if (req.body && typeof req.body === 'object') {
      const removed = stripMongoOperators(req.body)
      if (removed.length) {
        logger.warn('Removed MongoDB operators from request body', { requestId: req.id, path: req.path, removed })
      }
    }
    next()
  }
}

/** Shared settings: standard RateLimit headers, JSON error message. */
function limiter(options) {
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res, _next, opts) => {
      res.status(opts.statusCode).json({ message: options.message })
    },
    ...options,
  })
}

/**
 * Sign-in and registration: 10 failed attempts per 15 minutes per IP.
 * Created per app (not shared module state), so every test starts fresh.
 */
export function createAuthLimiter(limit = 10) {
  return limiter({
    windowMs: 15 * 60 * 1000,
    limit,
    skipSuccessfulRequests: true,
    message: 'Too many attempts. Please wait 15 minutes and try again.',
  })
}

/** General API limit: 300 requests per minute per IP. */
export function createApiLimiter(limit = 300) {
  return limiter({
    windowMs: 60 * 1000,
    limit,
    message: 'Too many requests. Please slow down.',
  })
}
