import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/ApiError'
import { http } from '../api/httpClient'
import { resetDbForTests } from './db'
import { mutateOrQueue } from './mutations'
import { clearUserData, getStorageSummary, loadLastUser, loadWithCache, saveLastUser } from './offlineCache'
import { enqueue, flushOutbox, listQueued } from './outbox'

const offlineError = new ApiError('You are offline.', 0)

beforeEach(() => {
  // A brand-new, empty IndexedDB for every test.
  globalThis.indexedDB = new IDBFactory()
  resetDbForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loadWithCache (network first, IndexedDB fallback)', () => {
  it('returns fresh data and saves a copy', async () => {
    const result = await loadWithCache('u1', 'claims:list', async () => ['claim-a'])
    expect(result).toMatchObject({ data: ['claim-a'], fromCache: false })
    expect((await getStorageSummary('u1')).cached).toBe(1)
  })

  it('returns the saved copy when offline', async () => {
    await loadWithCache('u1', 'claims:list', async () => ['claim-a'])
    const result = await loadWithCache('u1', 'claims:list', async () => {
      throw offlineError
    })
    expect(result).toMatchObject({ data: ['claim-a'], fromCache: true })
  })

  it('does not show another user\'s cached data', async () => {
    await loadWithCache('u1', 'claims:list', async () => ['private'])
    await expect(
      loadWithCache('u2', 'claims:list', async () => {
        throw offlineError
      }),
    ).rejects.toBe(offlineError)
  })

  it('passes on server errors instead of hiding them with old data', async () => {
    await loadWithCache('u1', 'listings:1', async () => ({ id: 1 }))
    const forbidden = new ApiError('Forbidden', 403)
    await expect(
      loadWithCache('u1', 'listings:1', async () => {
        throw forbidden
      }),
    ).rejects.toBe(forbidden)
  })
})

describe('outbox', () => {
  const item = (label: string) => ({ userId: 'u1', method: 'POST' as const, path: '/claims', body: { label }, label })

  it('queues changes in order', async () => {
    await enqueue(item('first'))
    await enqueue(item('second'))
    expect((await listQueued('u1')).map((queued) => queued.label)).toEqual(['first', 'second'])
  })

  it('sends queued changes and empties the queue', async () => {
    const request = vi.spyOn(http, 'request').mockResolvedValue({})
    await enqueue(item('first'))
    await enqueue(item('second'))
    const result = await flushOutbox('u1')
    expect(result.synced).toEqual(['first', 'second'])
    expect(request).toHaveBeenCalledTimes(2)
    expect(await listQueued('u1')).toHaveLength(0)
  })

  it('drops a change the server rejects and reports it', async () => {
    vi.spyOn(http, 'request')
      .mockRejectedValueOnce(new ApiError('Sorry, this food has already been claimed.', 409))
      .mockResolvedValueOnce({})
    await enqueue(item('claim bread'))
    await enqueue(item('claim apples'))
    const result = await flushOutbox('u1')
    expect(result.failed).toEqual([{ label: 'claim bread', message: 'Sorry, this food has already been claimed.' }])
    expect(result.synced).toEqual(['claim apples'])
  })

  it('stops and keeps the rest when the connection drops again', async () => {
    vi.spyOn(http, 'request').mockResolvedValueOnce({}).mockRejectedValueOnce(offlineError)
    await enqueue(item('first'))
    await enqueue(item('second'))
    const result = await flushOutbox('u1')
    expect(result).toMatchObject({ synced: ['first'], stillOffline: true })
    expect((await listQueued('u1')).map((queued) => queued.label)).toEqual(['second'])
  })
})

describe('mutateOrQueue', () => {
  it('sends the change straight away when online', async () => {
    vi.spyOn(http, 'request').mockResolvedValue({ claim: { id: 'c1' } })
    const result = await mutateOrQueue('u1', { method: 'POST', path: '/claims', body: {}, label: 'Claim' })
    expect(result).toEqual({ queued: false, data: { claim: { id: 'c1' } } })
  })

  it('queues the change when the request cannot reach the server', async () => {
    vi.spyOn(http, 'request').mockRejectedValue(offlineError)
    const result = await mutateOrQueue('u1', { method: 'POST', path: '/claims', body: {}, label: 'Claim' })
    expect(result).toEqual({ queued: true })
    expect(await listQueued('u1')).toHaveLength(1)
  })

  it('queues without trying when the browser is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const request = vi.spyOn(http, 'request')
    expect(await mutateOrQueue('u1', { method: 'DELETE', path: '/claims/1', label: 'Cancel' })).toEqual({ queued: true })
    expect(request).not.toHaveBeenCalled()
  })
})

describe('sign-out clean-up', () => {
  it('deletes the user\'s cache, queue and saved profile', async () => {
    await loadWithCache('u1', 'claims:list', async () => [1])
    await enqueue({ userId: 'u1', method: 'POST', path: '/claims', label: 'x' })
    await saveLastUser({ id: 'u1', name: 'Tama' } as never)
    await clearUserData('u1')
    expect(await getStorageSummary('u1')).toEqual({ cached: 0, queued: 0 })
    expect(await loadLastUser()).toBeUndefined()
  })
})
