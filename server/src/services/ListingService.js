/**
 * Feature 1: surplus food listings (create, read, update, delete).
 */
import { EVENTS } from '../events/EventBus.js'
import { checkPickupWindow } from '../validation/schemas.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js'

export class ListingService {
  /**
   * @param {{
   *   listings: import('../repositories/ListingRepository.js').ListingRepository,
   *   claims: import('../repositories/ClaimRepository.js').ClaimRepository,
   *   eventBus: import('../events/EventBus.js').EventBus,
   * }} deps
   */
  constructor({ listings, claims, eventBus }) {
    this.listings = listings
    this.claims = claims
    this.eventBus = eventBus
  }

  /** @param {{ id: string, role: string, name: string }} user */
  async create(user, data) {
    const listing = await this.listings.create({ ...data, donor: user.id, status: 'available' })
    const result = listing.toPublic()
    this.eventBus.publish(EVENTS.LISTING_CREATED, { listing: result, donor: user })
    return result
  }

  /** Open listings for the browse page, with paging. */
  async browse({ q, ...filters }) {
    // The query string calls the search text "q"; the repository calls it "search".
    const { items, total, page, limit } = await this.listings.findOpen({ ...filters, search: q })
    return {
      items: items.map((listing) => listing.toPublic()),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }

  async listMine(user) {
    const listings = await this.listings.findByDonor(user.id)
    return listings.map((listing) => listing.toPublic())
  }

  /**
   * Any signed-in user can view a listing. The owner (and admins) also see
   * the claim that currently holds it, if any.
   */
  async get(user, id) {
    const listing = await this.listings.findByIdWithDonor(id)
    if (!listing) throw new NotFoundError('Listing not found.')

    const result = listing.toPublic()
    if (this.canManage(user, listing)) {
      const activeClaim = await this.claims.findActiveForListing(id)
      result.activeClaim = activeClaim ? activeClaim.toPublic() : null
    }
    return result
  }

  async update(user, id, changes) {
    const listing = await this.findManageable(user, id)
    if (listing.status !== 'available') {
      throw new ConflictError('This listing has been claimed, so it can no longer be edited.')
    }

    // Check the pickup window with the merged values: a change to only one
    // end must still leave a valid window.
    if (changes.pickupStart || changes.pickupEnd) {
      const errors = checkPickupWindow(changes.pickupStart ?? listing.pickupStart, changes.pickupEnd ?? listing.pickupEnd)
      if (Object.keys(errors).length) throw new ValidationError('Please correct the pickup times.', errors)
    }

    await this.listings.updateById(id, changes)
    const result = (await this.listings.findByIdWithDonor(id)).toPublic()
    this.eventBus.publish(EVENTS.LISTING_UPDATED, { listing: result, user })
    return result
  }

  async remove(user, id) {
    const listing = await this.findManageable(user, id)
    if (listing.status === 'reserved') {
      throw new ConflictError('This listing has an active claim. Decline or complete the claim before deleting it.')
    }
    await this.listings.deleteById(id)
    // Remove the listing's claim history too, so no claim points at a
    // listing that no longer exists.
    await this.claims.deleteByListing(id)
    this.eventBus.publish(EVENTS.LISTING_DELETED, { listingId: id, user })
  }

  /** @private */
  canManage(user, listing) {
    const donorId = listing.donor._id ? listing.donor._id.toString() : listing.donor.toString()
    return user.role === 'admin' || donorId === user.id
  }

  /** @private Loads a listing the user owns (or any listing, for admins). */
  async findManageable(user, id) {
    const listing = await this.listings.findById(id)
    if (!listing) throw new NotFoundError('Listing not found.')
    if (!this.canManage(user, listing)) throw new ForbiddenError('You can only change your own listings.')
    return listing
  }
}
