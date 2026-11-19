/**
 * Network-first data loading with an IndexedDB fallback.
 *
 * loadWithCache('listings:browse', fetcher) tries the network. On success
 * it saves the result and returns it. If there is no connection it returns
 * the last saved copy instead (marked fromCache, with the time it was
 * saved), so the screen still works offline. Other errors (403, 404...)
 * are passed on, because cached data would hide a real problem.
 */
import { ApiError } from '../api/ApiError'
import { createLogger } from '../utils/logger'
import { getDb, type CacheEntry, type SessionEntry } from './db'

const log = createLogger('offline')

export interface Loaded<T> {
  data: T
  fromCache: boolean
  savedAt: string
}

const fullKey = (userId: string, key: string) => `${userId}:${key}`

export async function readCache<T>(userId: string, key: string): Promise<CacheEntry<T> | undefined> {
  const db = await getDb()
  return (await db.get('cache', fullKey(userId, key))) as CacheEntry<T> | undefined
}

export async function writeCache<T>(userId: string, key: string, data: T): Promise<void> {
  const db = await getDb()
  await db.put('cache', { key: fullKey(userId, key), userId, data, savedAt: new Date().toISOString() })
}

export async function loadWithCache<T>(userId: string, key: string, fetcher: () => Promise<T>): Promise<Loaded<T>> {
  try {
    const data = await fetcher()
    // A failed cache write must not break the screen.
    await writeCache(userId, key, data).catch((error) => log.warn('Could not save to IndexedDB', error))
    return { data, fromCache: false, savedAt: new Date().toISOString() }
  } catch (error) {
    if (!(error instanceof ApiError) || !error.isNetworkError) throw error

    const cached = await readCache<T>(userId, key)
    if (!cached) throw error
    log.info(`Offline: showing cached "${key}" from ${cached.savedAt}`)
    return { data: cached.data, fromCache: true, savedAt: cached.savedAt }
  }
}

/** Deletes every cached response and queued change for a user. */
export async function clearUserData(userId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['cache', 'outbox', 'session'], 'readwrite')
  for (const storeName of ['cache', 'outbox'] as const) {
    const store = tx.objectStore(storeName)
    for (const key of await store.index('byUser').getAllKeys(userId)) await store.delete(key)
  }
  await tx.objectStore('session').delete('lastUser')
  await tx.done
}

export async function saveLastUser(user: SessionEntry['user']): Promise<void> {
  const db = await getDb()
  await db.put('session', { key: 'lastUser', user, savedAt: new Date().toISOString() })
}

export async function loadLastUser(): Promise<SessionEntry | undefined> {
  const db = await getDb()
  return db.get('session', 'lastUser')
}

/** Counts per store, for the "Offline storage" panel on the Profile page. */
export async function getStorageSummary(userId: string) {
  const db = await getDb()
  const [cached, queued] = await Promise.all([
    db.countFromIndex('cache', 'byUser', userId),
    db.countFromIndex('outbox', 'byUser', userId),
  ])
  return { cached, queued }
}
