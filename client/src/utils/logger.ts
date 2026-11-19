/**
 * Small frontend logger.
 *
 * - Prefixes every line with [KaiShare] and the area (e.g. [auth]) so app
 *   logs are easy to filter in the DevTools console.
 * - Debug lines are only printed in development builds.
 * - Keeps the last 100 entries in memory; the Profile page shows them as
 *   "Recent activity", which helps when a user reports a problem.
 */
type Level = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  time: string
  level: Level
  area: string
  message: string
}

const MAX_ENTRIES = 100
const entries: LogEntry[] = []

function write(level: Level, area: string, message: string, detail?: unknown) {
  if (level === 'debug' && !import.meta.env.DEV) return
  entries.push({ time: new Date().toISOString(), level, area, message })
  if (entries.length > MAX_ENTRIES) entries.shift()

  const line = `[KaiShare] [${area}] ${message}`
  const args = detail === undefined ? [line] : [line, detail]
  console[level](...args)
}

/** A logger for one area of the app, e.g. createLogger('offline'). */
export function createLogger(area: string) {
  return {
    debug: (message: string, detail?: unknown) => write('debug', area, message, detail),
    info: (message: string, detail?: unknown) => write('info', area, message, detail),
    warn: (message: string, detail?: unknown) => write('warn', area, message, detail),
    error: (message: string, detail?: unknown) => write('error', area, message, detail),
  }
}

export function getRecentLogs(): readonly LogEntry[] {
  return [...entries].reverse()
}
