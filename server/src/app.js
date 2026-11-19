/**
 * Builds the Express application. Kept separate from index.js (which
 * connects to MongoDB and opens a port) so tests can create the app and
 * send requests to it with supertest.
 */
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'
import { createApiLimiter, sanitizeBody } from './middleware/security.js'
import { createApiRouter } from './routes/index.js'

/** @param {ReturnType<typeof import('./container.js').createContainer>} container */
export function createApp(container) {
  const { config, logger } = container
  const app = express()

  // The Vite dev/preview server (or a load balancer in production) sits in
  // front of the API on the same machine; trust its X-Forwarded-For header
  // so rate limiting sees the real client IP.
  app.set('trust proxy', 'loopback')
  app.disable('x-powered-by')

  // Security headers: HSTS, no MIME sniffing, frame blocking, a strict
  // Content-Security-Policy for any HTML the API might return, etc.
  app.use(helmet())

  // Only the KaiShare web app's origins may call the API from a browser,
  // and only they may send the refresh-token cookie (credentials).
  app.use(
    cors({
      origin(origin, callback) {
        // Requests without an Origin header (Postman, curl, same-origin) are allowed.
        callback(null, !origin || config.corsOrigins.includes(origin))
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  )

  app.use(requestLogger(logger))
  app.use(express.json({ limit: '20kb' }))
  app.use(cookieParser())
  app.use(sanitizeBody(logger))
  app.use('/api', createApiLimiter(config.isTest ? 10_000 : 300))

  app.use('/api', createApiRouter(container))

  app.use(notFoundHandler)
  app.use(errorHandler(logger))
  return app
}
