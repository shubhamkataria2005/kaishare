import { http } from './httpClient'

export interface PushResult {
  message: string
  sent: number
  failed: number
  removed: number
}

export const pushApi = {
  publicKey: () => http.get<{ publicKey: string }>('/push/public-key', { auth: false }),
  status: () => http.get<{ configured: boolean; subscriptions: number }>('/push/status'),
  subscribe: (subscription: PushSubscriptionJSON) => http.post<{ message: string }>('/push/subscriptions', subscription),
  unsubscribe: (endpoint: string) => http.delete('/push/subscriptions', { endpoint }),
  sendTest: () => http.post<PushResult>('/push/test'),
  broadcast: (title: string, body: string) => http.post<PushResult>('/push/broadcast', { title, body, url: '/' }),
}
