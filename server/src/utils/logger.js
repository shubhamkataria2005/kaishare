/**
 * Application logger (Singleton).
 *
 * ES modules are only evaluated once, so every file that imports `logger`
 * shares this one Winston instance and its transports.
 *
 * - Console: coloured, human-readable lines while developing.
 * - logs/app.log: JSON lines (easy to search and to ship to a log service).
 * - logs/error.log: errors only, so failures are quick to find.
 *
 * File logging is switched off in tests to keep test runs clean.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import winston from 'winston'
import { config } from '../config/env.js'

const logDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../logs')

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} ${level}: ${message}${extra}`
  }),
)

const transports = [new winston.transports.Console({ format: consoleFormat, silent: config.isTest })]

if (!config.isTest) {
  const fileFormat = winston.format.combine(winston.format.timestamp(), winston.format.json())
  transports.push(
    new winston.transports.File({ filename: path.join(logDir, 'app.log'), format: fileFormat }),
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', format: fileFormat }),
  )
}

export const logger = winston.createLogger({
  level: config.logLevel,
  transports,
})
