/**
 * Observers that turn domain events into push notifications.
 *
 * This is the only place that decides who hears about what. The listing
 * and claim services just publish events and know nothing about push.
 */
import { EVENTS } from '../events/EventBus.js'

const timeFormat = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'Pacific/Auckland',
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatTime(date) {
  return timeFormat.format(new Date(date))
}

const STATUS_MESSAGES = {
  confirmed: (title) => ({ title: 'Pickup confirmed', body: `The donor confirmed your pickup of "${title}".` }),
  declined: (title) => ({ title: 'Claim declined', body: `The donor declined your claim for "${title}".` }),
  collected: (title) => ({ title: 'Pickup complete', body: `Thanks for rescuing "${title}"!` }),
}

/**
 * @param {import('../events/EventBus.js').EventBus} eventBus
 * @param {import('../services/NotificationService.js').NotificationService} notifications
 * @param {import('../repositories/ListingRepository.js').ListingRepository} listings
 */
export function registerNotificationListeners(eventBus, notifications, listings) {
  // New food posted -> every rescuer.
  eventBus.subscribe(EVENTS.LISTING_CREATED, ({ listing, donor }) =>
    notifications.sendToRoles(
      ['rescuer'],
      {
        title: 'New surplus food',
        body: `${listing.quantity} ${listing.unit} of ${listing.title} in ${listing.suburb}, until ${formatTime(listing.pickupEnd)}.`,
        url: `/listings/${listing.id}`,
        tag: `listing-${listing.id}`,
      },
      { excludeUserId: donor.id },
    ),
  )

  // Listing claimed -> its donor.
  eventBus.subscribe(EVENTS.CLAIM_CREATED, ({ claim, rescuer }) =>
    notifications.sendToUsers([claim.donorId], {
      title: 'Your food has been claimed',
      body: `${rescuer.name} will collect "${claim.listing?.title}" at ${formatTime(claim.pickupTime)}.`,
      url: '/claims',
      tag: `claim-${claim.id}`,
    }),
  )

  // Pickup time changed -> the donor.
  eventBus.subscribe(EVENTS.CLAIM_UPDATED, ({ claimId, donorId, rescuer, pickupTime }) =>
    notifications.sendToUsers([donorId], {
      title: 'Pickup details changed',
      body: pickupTime
        ? `${rescuer.name} changed the pickup time to ${formatTime(pickupTime)}.`
        : `${rescuer.name} updated the note on their claim.`,
      url: '/claims',
      tag: `claim-${claimId}`,
    }),
  )

  // Claim confirmed/declined/collected -> the rescuer.
  eventBus.subscribe(EVENTS.CLAIM_STATUS_CHANGED, async ({ claimId, listingId, rescuerId, to }) => {
    const listing = await listings.findById(listingId)
    const message = STATUS_MESSAGES[to]?.(listing?.title ?? 'your claim')
    if (!message) return
    return notifications.sendToUsers([rescuerId], { ...message, url: '/claims', tag: `claim-${claimId}` })
  })

  // Claim cancelled -> the donor (the food is available again).
  eventBus.subscribe(EVENTS.CLAIM_CANCELLED, ({ listingId, donorId, rescuer }) =>
    notifications.sendToUsers([donorId], {
      title: 'Claim cancelled',
      body: `${rescuer.name} cancelled their pickup. Your listing is available again.`,
      url: `/listings/${listingId}`,
      tag: `listing-${listingId}`,
    }),
  )
}
