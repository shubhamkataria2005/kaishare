/**
 * Runs a change now, or queues it in the outbox when there is no
 * connection. The caller gets { queued: true } back and can tell the user
 * the change will be sent later.
 */
import { ApiError } from '../api/ApiError'
import { http } from '../api/httpClient'
import type { OutboxItem } from './db'
import { enqueue } from './outbox'

export type MutationResult<T> = { queued: false; data: T } | { queued: true }

export async function mutateOrQueue<T>(
  userId: string,
  request: Pick<OutboxItem, 'method' | 'path' | 'body' | 'label'>,
): Promise<MutationResult<T>> {
  const queue = async () => {
    await enqueue({ ...request, userId })
    return { queued: true } as const
  }

  if (!navigator.onLine) return queue()
  try {
    const data = await http.request<T>(request.path, { method: request.method, body: request.body })
    return { queued: false, data }
  } catch (error) {
    if (error instanceof ApiError && error.isNetworkError) return queue()
    throw error
  }
}
