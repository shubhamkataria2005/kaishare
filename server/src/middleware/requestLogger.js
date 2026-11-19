/**
 * Gives every request an id and logs one line when it finishes:
 *   POST /api/claims 201 34ms  {"requestId":"...","userId":"..."}
 *
 * The id is also returned in the X-Request-Id header, and the error handler
 * includes it in 500 responses, so a user's error report can be matched to
 * the exact log lines on the server.
 */
import { randomUUID } from 'node:crypto'

/** @param {import('winston').Logger} logger */
export function requestLogger(logger) {
  return (req, res, next) => {
    req.id = randomUUID()
    res.set('X-Request-Id', req.id)
    const startedAt = process.hrtime.bigint()

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http'
      logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`, {
        requestId: req.id,
        userId: req.user?.id,
      })
    })
    next()
  }
}
