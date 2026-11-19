/** Repository for pickup claims (feature 2). See listingRepository.ts. */
import { claimsApi, type ClaimChanges } from '../api/claimsApi'
import { mutateOrQueue } from '../offline/mutations'
import { loadWithCache } from '../offline/offlineCache'
import type { Claim, ClaimInput } from '../types'

export const claimRepository = {
  list(userId: string) {
    return loadWithCache(userId, 'claims:list', async () => (await claimsApi.list()).items)
  },

  create(userId: string, input: ClaimInput, listingTitle: string) {
    return mutateOrQueue<{ claim: Claim }>(userId, {
      method: 'POST',
      path: '/claims',
      body: input,
      label: `Claim "${listingTitle}"`,
    })
  },

  update(userId: string, id: string, changes: ClaimChanges, listingTitle: string) {
    const action = changes.status ? `Mark "${listingTitle}" ${changes.status}` : `Change pickup for "${listingTitle}"`
    return mutateOrQueue<{ claim: Claim }>(userId, {
      method: 'PATCH',
      path: `/claims/${encodeURIComponent(id)}`,
      body: changes,
      label: action,
    })
  },

  remove(userId: string, id: string, listingTitle: string) {
    return mutateOrQueue<void>(userId, {
      method: 'DELETE',
      path: `/claims/${encodeURIComponent(id)}`,
      label: `Cancel claim for "${listingTitle}"`,
    })
  },
}
