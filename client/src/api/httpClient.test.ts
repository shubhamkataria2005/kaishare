import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError'
import { HttpClient } from './httpClient'
import { tokenStore } from './tokenStore'

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('HttpClient', () => {
  let client: HttpClient
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    client = new HttpClient('/api')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    tokenStore.set('token-1', new Date(Date.now() + 60_000))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    tokenStore.clear()
  })

  it('sends the access token and JSON body', async () => {
    fetchMock.mockResolvedValue(json(201, { ok: true }))
    await client.post('/claims', { note: 'hi' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/claims')
    expect(init.headers.Authorization).toBe('Bearer token-1')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"note":"hi"}')
    expect(init.credentials).toBe('same-origin')
  })

  it('does not send the token for public endpoints', async () => {
    fetchMock.mockResolvedValue(json(200, {}))
    await client.get('/auth/providers', { auth: false })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('turns an error response into an ApiError with field errors', async () => {
    fetchMock.mockResolvedValue(json(400, { message: 'Please correct the highlighted fields.', errors: { title: 'Too short' } }))
    const error = (await client.post('/listings', {}).catch((e) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual({ title: 'Too short' })
  })

  it('reports a network failure as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = (await client.get('/listings').catch((e) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.isNetworkError).toBe(true)
  })

  it('refreshes the session once on 401 and retries with the new token', async () => {
    const refresh = vi.fn().mockResolvedValue('token-2')
    client.setAuthHooks({ refresh, onSessionExpired: vi.fn() })
    fetchMock.mockResolvedValueOnce(json(401, { message: 'expired' })).mockResolvedValueOnce(json(200, { items: [] }))

    await expect(client.get('/claims')).resolves.toEqual({ items: [] })
    expect(refresh).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-2')
  })

  it('reports an ended session when the refresh fails', async () => {
    const onSessionExpired = vi.fn()
    client.setAuthHooks({ refresh: vi.fn().mockResolvedValue(null), onSessionExpired })
    fetchMock.mockResolvedValue(json(401, { message: 'expired' }))

    await expect(client.get('/claims')).rejects.toMatchObject({ status: 401 })
    expect(onSessionExpired).toHaveBeenCalledOnce()
  })

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(json(204, null))
    await expect(client.delete('/claims/1')).resolves.toBeUndefined()
  })
})

describe('tokenStore', () => {
  it('forgets an expired token', () => {
    tokenStore.set('old', new Date(Date.now() - 1000))
    expect(tokenStore.get()).toBeNull()
  })
})
