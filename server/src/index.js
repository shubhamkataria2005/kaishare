/**
 * Starts the API: connects to MongoDB, then listens over HTTP, or over
 * HTTPS when HTTPS_KEY_FILE and HTTPS_CERT_FILE are set.
 */
import { readFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { createApp } from './app.js'
import { config } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { createContainer } from './container.js'
import { logger } from './utils/logger.js'

async function start() {
  await connectDatabase(config.mongoUri)

  const container = createContainer(config)
  const app = createApp(container)

  const useHttps = Boolean(config.https.keyFile && config.https.certFile)
  const server = useHttps
    ? https.createServer({ key: readFileSync(config.https.keyFile), cert: readFileSync(config.https.certFile) }, app)
    : http.createServer(app)

  server.listen(config.port, () => {
    logger.info(`KaiShare API listening on ${useHttps ? 'https' : 'http'}://localhost:${config.port} (${config.env})`)
    if (!container.services.notifications.sender.isConfigured) {
      logger.warn('VAPID keys are not set: push notifications are disabled. Run `npm run vapid`.')
    }
    if (!config.google.clientId) logger.warn('GOOGLE_CLIENT_ID is not set: Google sign-in is disabled.')
  })

  // Finish in-flight requests and close the database cleanly on Ctrl+C or
  // when the hosting platform stops the process.
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`)
    server.close(async () => {
      await disconnectDatabase()
      process.exit(0)
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.stack : reason })
})

start().catch((error) => {
  logger.error(`API failed to start: ${error.message}`)
  process.exit(1)
})
