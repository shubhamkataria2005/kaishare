/**
 * MongoDB connection (Singleton).
 *
 * Mongoose keeps one connection pool per process; this module wraps it so
 * the rest of the app only calls connect(), disconnect() and getStatus().
 *
 * The same code works with the local Docker replica set and with MongoDB
 * Atlas: only MONGODB_URI changes. With a replica set the driver discovers
 * every member, sends writes to the primary and automatically moves to the
 * new primary after a failover (retryWrites/retryReads are on by default).
 */
import mongoose from 'mongoose'
import { logger } from '../utils/logger.js'

// Reject query filters that contain operators such as { $gt: '' } coming
// from user input (protection against NoSQL injection), and only allow
// fields that are defined in a schema to be used in queries.
mongoose.set('sanitizeFilter', true)
mongoose.set('strictQuery', true)

let connectPromise = null

/**
 * Connects once; later calls reuse the same connection.
 *
 * @param {string} uri MongoDB connection string
 */
export async function connectDatabase(uri) {
  if (!connectPromise) {
    connectPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 20,
        // Majority write concern: a write is acknowledged only once most
        // replica set members have it, so it survives a primary failure.
        w: 'majority',
      })
      .then((connection) => {
        const { host, name } = connection.connection
        logger.info(`MongoDB connected to database "${name}" via ${host}`)
        return connection
      })
      .catch((error) => {
        connectPromise = null
        throw error
      })

    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
    mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'))
  }
  return connectPromise
}

export async function disconnectDatabase() {
  connectPromise = null
  await mongoose.disconnect()
}

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting']

/**
 * Connection and replica set details for the health endpoint.
 * `hello` is a lightweight command every member answers.
 */
export async function getDatabaseStatus() {
  const state = STATES[mongoose.connection.readyState] ?? 'unknown'
  if (state !== 'connected') return { state }

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 })
    return {
      state,
      database: mongoose.connection.name,
      replicaSet: hello.setName ?? null,
      primary: hello.primary ?? null,
      members: hello.hosts ?? [],
    }
  } catch (error) {
    logger.warn('Could not read replica set status', { error: error.message })
    return { state }
  }
}
