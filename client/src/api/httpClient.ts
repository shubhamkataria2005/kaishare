/**
 * HTTP client (Facade + Singleton).
 *
 * The rest of the app calls http.get/post/patch/delete and never deals
 * with fetch(), headers, JSON parsing, tokens or error formats directly.
 *
 * - Adds "Authorization: Bearer <access token>" to authenticated requests.
 * - If the API answers 401 (token expired), it refreshes the session once
 *   and retries the request, so users are not signed out every 15 minutes.
 * - Turns every failure into an ApiError; status 0 means "no connection",
 *   which the offline layer uses to decide to serve cached data or queue
 *   the change for later.
 */
import { createLogger } from '../utils/logger'
import { ApiError } from './ApiError'
import { tokenStore } from './tokenStore'

const log = createLogger('http')

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  method?: Method
  body?: unknown
  /** Send the access token (default true). */
  auth?: boolean
  signal?: AbortSignal
}

/** Hooks the auth layer plugs in (keeps this file independent of React). */
export interface AuthHooks {
  /** Gets a fresh access token, or returns null when the session has ended. */
  refresh: () => Promise<string | null>
  /** Called when the session cannot be refreshed. */
  onSessionExpired: () => void
}

export class HttpClient {
  private authHooks: AuthHooks | null = null
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setAuthHooks(hooks: AuthHooks | null) {
    this.authHooks = hooks
  }

  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'GET' })
  }

  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'POST', body })
  }

  patch<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'PATCH', body })
  }

  delete<T = void>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'DELETE', body })
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { auth = true } = options
    let response = await this.send(path, options, auth ? tokenStore.get() : null)

    // Expired or missing access token: refresh once, then retry.
    if (response.status === 401 && auth && this.authHooks) {
      log.debug(`401 on ${path}, refreshing the session`)
      const newToken = await this.authHooks.refresh().catch(() => null)
      if (!newToken) {
        this.authHooks.onSessionExpired()
        throw await this.toError(response)
      }
      response = await this.send(path, options, newToken)
    }

    if (!response.ok) throw await this.toError(response)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  private async send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        // Same-origin only: the refresh cookie is never sent anywhere else.
        credentials: 'same-origin',
        signal: options.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      // fetch() only rejects when no response arrived at all.
      log.warn(`No response for ${options.method ?? 'GET'} ${path}`)
      const message = navigator.onLine
        ? 'Cannot reach KaiShare right now. Please try again in a moment.'
        : 'You are offline.'
      throw new ApiError(message, 0)
    }
  }

  private async toError(response: Response): Promise<ApiError> {
    // Some errors (e.g. from a proxy) are not JSON, so parse carefully.
    const data = await response.json().catch(() => ({}))
    const message = typeof data.message === 'string' ? data.message : `Request failed (${response.status}).`
    if (response.status >= 500) log.error(`Server error ${response.status}`, data)
    return new ApiError(message, response.status, data.errors ?? {})
  }
}

export const http = new HttpClient('/api')
