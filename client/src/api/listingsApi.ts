import type { Category, Listing, ListingInput, ListingPage } from '../types'
import { http } from './httpClient'

export interface ListingQuery {
  category?: Category | ''
  suburb?: string
  q?: string
  page?: number
}

/** Builds "?category=bakery&page=2", leaving out empty values. */
export function toQueryString(query: ListingQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '' && value !== null) params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

export const listingsApi = {
  browse: (query: ListingQuery = {}) => http.get<ListingPage>(`/listings${toQueryString(query)}`),
  mine: () => http.get<{ items: Listing[] }>('/listings/mine'),
  get: (id: string) => http.get<{ listing: Listing }>(`/listings/${encodeURIComponent(id)}`),
  create: (input: ListingInput) => http.post<{ listing: Listing }>('/listings', input),
  update: (id: string, changes: Partial<ListingInput>) => http.patch<{ listing: Listing }>(`/listings/${encodeURIComponent(id)}`, changes),
  remove: (id: string) => http.delete(`/listings/${encodeURIComponent(id)}`),
}
