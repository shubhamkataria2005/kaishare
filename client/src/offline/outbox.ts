/**
 * Outbox: changes made while offline are queued in IndexedDB and sent, in
 * the order they were made, when the connection comes back.
 *
 * Why not the Background Sync API in the service worker? The access token
 * lives only in page memory (never in storage the worker could read), so
 * the page must be open to send authenticated requests. Replaying from
 * the page on the "online" event keeps that security property.
 */
import { ApiError } from '../api/ApiError'
import { http } from '../api/httpClient'
import { createLogger } from '../utils/logger'
import { getDb, type OutboxItem } from './db'

const log = createLogger('outbox')

/** Listeners that want to know when the queue changes (the header badge). */
const listeners = new Set<() => void>()

export function onOutboxChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  listeners.forEach((listener) => listener())
}

export async function enqueue(item: Omit<OutboxItem, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDb()
  const id = await db.add('outbox', { ...item, createdAt: new Date().toISOString() })
  log.info(`Queued offline change: ${item.label}`)
  notify()
  return id
}

export async function listQueued(userId: string): Promise<OutboxItem[]> {
  const db = await getDb()
  const items = await db.getAllFromIndex('outbox', 'byUser', userId)
  return items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
}

export async function removeQueued(id: number): Promise<void> {
  const db = await getDb()
  await db.delete('outbox', id)
  notify()
}

export interface FlushResult {
  synced: string[]
  failed: { label: string; message: string }[]
  /** True when the connection dropped again before the queue was empty. */
  stillOffline: boolean
}

let flushing: Promise<FlushResult> | null = null

/**
 * Sends every queued change for the user, oldest first.
 * - success: removed from the queue
 * - rejected by the server (e.g. 409 "already claimed"): removed, and
 *   reported so the user knows that change did not happen
 * - no connection: stop and keep the rest for next time
 *
 * Concurrent calls share one run, so a change is never sent twice.
 */
export function flushOutbox(userId: string): Promise<FlushResult> {
  flushing ??= runFlush(userId).finally(() => {
    flushing = null
  })
  return flushing
}

async function runFlush(userId: string): Promise<FlushResult> {
  const result: FlushResult = { synced: [], failed: [], stillOffline: false }

  for (const item of await listQueued(userId)) {
    try {
      await http.request(item.path, { method: item.method, body: item.body })
      result.synced.push(item.label)
    } catch (error) {
      if (error instanceof ApiError && error.isNetworkError) {
        result.stillOffline = true
        break
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      log.warn(`Queued change "${item.label}" was rejected: ${message}`)
      result.failed.push({ label: item.label, message })
    }
    await removeQueued(item.id!)
  }

  if (result.synced.length || result.failed.length) {
    log.info(`Outbox sync: ${result.synced.length} sent, ${result.failed.length} rejected`)
  }
  return result
}
