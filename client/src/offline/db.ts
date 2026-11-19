/**
 * The app's IndexedDB database (via the small `idb` promise wrapper).
 *
 * Stores:
 * - cache:   the last API response for each screen, per user, so lists and
 *            details can be shown offline.
 * - outbox:  changes made while offline, replayed in order when the
 *            connection returns.
 * - session: the last signed-in user's public profile, so the app can open
 *            in offline mode. Tokens are never stored here.
 *
 * Everything for a user is deleted when they sign out.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface CacheEntry<T = unknown> {
  key: string
  userId: string
  data: T
  savedAt: string
}

export interface OutboxItem {
  id?: number
  userId: string
  method: 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  /** Shown to the user, e.g. "Claim Sourdough loaves". */
  label: string
  createdAt: string
}

export interface SessionEntry {
  key: 'lastUser'
  user: import('../types').User
  savedAt: string
}

interface KaiShareDB extends DBSchema {
  cache: { key: string; value: CacheEntry; indexes: { byUser: string } }
  outbox: { key: number; value: OutboxItem; indexes: { byUser: string } }
  session: { key: string; value: SessionEntry }
}

const DB_NAME = 'kaishare-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<KaiShareDB>> | null = null

export function getDb(): Promise<IDBPDatabase<KaiShareDB>> {
  dbPromise ??= openDB<KaiShareDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const cache = db.createObjectStore('cache', { keyPath: 'key' })
      cache.createIndex('byUser', 'userId')
      const outbox = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
      outbox.createIndex('byUser', 'userId')
      db.createObjectStore('session', { keyPath: 'key' })
    },
  })
  return dbPromise
}

/** For tests: forget the open connection so a fresh database is used. */
export function resetDbForTests() {
  dbPromise = null
}
