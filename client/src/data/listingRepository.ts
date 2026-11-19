/**
 * Repository for listings (feature 1). Pages call these functions and do
 * not need to know whether data came from the network or the offline
 * cache, or whether a change was sent now or queued for later.
 */
import { listingsApi, toQueryString, type ListingQuery } from '../api/listingsApi'
import { mutateOrQueue } from '../offline/mutations'
import { loadWithCache } from '../offline/offlineCache'
import type { Listing, ListingInput } from '../types'

export const listingRepository = {
  browse(userId: string, query: ListingQuery) {
    return loadWithCache(userId, `listings:browse${toQueryString(query)}`, () => listingsApi.browse(query))
  },

  mine(userId: string) {
    return loadWithCache(userId, 'listings:mine', async () => (await listingsApi.mine()).items)
  },

  get(userId: string, id: string) {
    return loadWithCache(userId, `listings:${id}`, async () => (await listingsApi.get(id)).listing)
  },

  create(userId: string, input: ListingInput) {
    return mutateOrQueue<{ listing: Listing }>(userId, {
      method: 'POST',
      path: '/listings',
      body: input,
      label: `New listing "${input.title}"`,
    })
  },

  update(userId: string, id: string, changes: Partial<ListingInput>, title: string) {
    return mutateOrQueue<{ listing: Listing }>(userId, {
      method: 'PATCH',
      path: `/listings/${encodeURIComponent(id)}`,
      body: changes,
      label: `Edit listing "${title}"`,
    })
  },

  remove(userId: string, id: string, title: string) {
    return mutateOrQueue<void>(userId, {
      method: 'DELETE',
      path: `/listings/${encodeURIComponent(id)}`,
      label: `Delete listing "${title}"`,
    })
  },
}
