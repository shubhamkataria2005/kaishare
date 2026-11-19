import type { Claim, ClaimInput, ClaimStatus } from '../types'
import { http } from './httpClient'

export interface ClaimChanges {
  pickupTime?: string
  note?: string
  status?: Exclude<ClaimStatus, 'pending'>
}

export const claimsApi = {
  list: () => http.get<{ items: Claim[] }>('/claims'),
  get: (id: string) => http.get<{ claim: Claim }>(`/claims/${encodeURIComponent(id)}`),
  create: (input: ClaimInput) => http.post<{ claim: Claim }>('/claims', input),
  update: (id: string, changes: ClaimChanges) => http.patch<{ claim: Claim }>(`/claims/${encodeURIComponent(id)}`, changes),
  remove: (id: string) => http.delete(`/claims/${encodeURIComponent(id)}`),
}
