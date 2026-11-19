/**
 * Feature 2: pickup claims (create, read, update, delete).
 *
 * A rescuer claims an available listing and picks a pickup time inside its
 * window. The donor then confirms or declines it, and marks it collected
 * once the food has been picked up. The rescuer can change the time or
 * note, or cancel (delete) the claim, while it is still active.
 */
import { EVENTS } from '../events/EventBus.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js'
import { getTransition, isActive } from './claimStateMachine.js'

// A pickup time may be a few minutes in the past (clock differences,
// or the rescuer is already on the way).
const PAST_TOLERANCE_MS = 5 * 60 * 1000

/**
 * The id of a reference that may or may not be populated. A populated
 * reference is a whole document, and calling toString() on it does not give
 * the id, so comparing it with a user id would always fail.
 */
export function refId(ref) {
  return ref?._id ? ref._id.toString() : ref?.toString()
}

export class ClaimService {
  /**
   * @param {{
   *   claims: import('../repositories/ClaimRepository.js').ClaimRepository,
   *   listings: import('../repositories/ListingRepository.js').ListingRepository,
   *   eventBus: import('../events/EventBus.js').EventBus,
   * }} deps
   */
  constructor({ claims, listings, eventBus }) {
    this.claims = claims
    this.listings = listings
    this.eventBus = eventBus
  }

  async create(user, { listingId, pickupTime, note }) {
    const listing = await this.listings.findById(listingId)
    if (!listing) throw new NotFoundError('Listing not found.')
    if (listing.status !== 'available') throw new ConflictError('Sorry, this food has already been claimed.')
    if (listing.pickupEnd < new Date()) throw new ConflictError('The pickup window for this listing has closed.')
    this.checkPickupTime(pickupTime, listing)

    // Reserve the listing atomically. If another rescuer got there first,
    // the update matches nothing and returns null.
    const reserved = await this.listings.transitionStatus(listingId, 'available', 'reserved')
    if (!reserved) throw new ConflictError('Sorry, this food has just been claimed by someone else.')

    let claim
    try {
      claim = await this.claims.create({
        listing: listingId,
        rescuer: user.id,
        donor: listing.donor,
        pickupTime,
        note,
        status: 'pending',
      })
    } catch (error) {
      // Undo the reservation so the listing is not stuck as "reserved".
      await this.listings.transitionStatus(listingId, 'reserved', 'available')
      throw error
    }

    const result = (await this.claims.findByIdPopulated(claim.id)).toPublic()
    this.eventBus.publish(EVENTS.CLAIM_CREATED, { claim: result, rescuer: user })
    return result
  }

  /** Rescuers see their own claims, donors the claims on their listings, admins all. */
  async list(user) {
    const claims =
      user.role === 'rescuer'
        ? await this.claims.findByRescuer(user.id)
        : user.role === 'donor'
          ? await this.claims.findByDonor(user.id)
          : await this.claims.findAll()
    return claims.map((claim) => claim.toPublic())
  }

  async get(user, id) {
    const claim = await this.claims.findByIdPopulated(id)
    if (!claim || !this.canView(user, claim)) throw new NotFoundError('Claim not found.')
    return claim.toPublic()
  }

  /**
   * Rescuers change pickupTime/note; donors change status. A request that
   * mixes the two, or comes from someone else, is rejected.
   */
  async update(user, id, changes) {
    const claim = await this.claims.findById(id)
    if (!claim || !this.canView(user, claim)) throw new NotFoundError('Claim not found.')

    const { status, ...details } = changes
    const changesDetails = details.pickupTime !== undefined || details.note !== undefined

    if (changesDetails) await this.updateDetails(user, claim, details)
    if (status && status !== claim.status) await this.changeStatus(user, claim, status)

    return (await this.claims.findByIdPopulated(id)).toPublic()
  }

  /** Cancels (deletes) a claim. An active claim frees its listing again. */
  async remove(user, id) {
    const claim = await this.claims.findById(id)
    if (!claim || !this.canView(user, claim)) throw new NotFoundError('Claim not found.')
    if (user.role !== 'admin' && claim.rescuer.toString() !== user.id) {
      throw new ForbiddenError('Only the rescuer who made this claim can cancel it.')
    }
    if (claim.status === 'collected') {
      throw new ConflictError('A collected claim is a record of a completed pickup and cannot be deleted.')
    }

    await this.claims.deleteById(id)
    if (isActive(claim.status)) {
      await this.listings.transitionStatus(claim.listing.toString(), 'reserved', 'available')
      this.eventBus.publish(EVENTS.CLAIM_CANCELLED, {
        claimId: id,
        listingId: claim.listing.toString(),
        donorId: claim.donor.toString(),
        rescuer: user,
      })
    }
  }

  /** @private */
  async updateDetails(user, claim, { pickupTime, note }) {
    if (claim.rescuer.toString() !== user.id && user.role !== 'admin') {
      throw new ForbiddenError('Only the rescuer who made this claim can change its pickup details.')
    }
    if (!isActive(claim.status)) {
      throw new ConflictError(`This claim is ${claim.status}, so it can no longer be changed.`)
    }

    const changes = {}
    if (pickupTime !== undefined) {
      const listing = await this.listings.findById(claim.listing.toString())
      if (listing) this.checkPickupTime(pickupTime, listing)
      changes.pickupTime = pickupTime
    }
    if (note !== undefined) changes.note = note

    await this.claims.updateById(claim.id, changes)
    this.eventBus.publish(EVENTS.CLAIM_UPDATED, {
      claimId: claim.id,
      donorId: claim.donor.toString(),
      rescuer: user,
      pickupTime: changes.pickupTime,
    })
  }

  /** @private */
  async changeStatus(user, claim, status) {
    const transition = getTransition(claim.status, status)
    if (!transition) {
      throw new ConflictError(`A ${claim.status} claim cannot be changed to ${status}.`)
    }
    const isOwnerDonor = claim.donor.toString() === user.id
    if (!transition.by.includes(user.role) || (user.role === 'donor' && !isOwnerDonor)) {
      throw new ForbiddenError('Only the donor of this listing can confirm, decline or complete a claim.')
    }

    await this.claims.updateById(claim.id, { status })
    if (transition.listing) {
      await this.listings.transitionStatus(claim.listing.toString(), transition.listing.from, transition.listing.to)
    }

    this.eventBus.publish(EVENTS.CLAIM_STATUS_CHANGED, {
      claimId: claim.id,
      listingId: claim.listing.toString(),
      rescuerId: claim.rescuer.toString(),
      from: claim.status,
      to: status,
      changedBy: user,
    })
  }

  /** @private The pickup time must fall inside the listing's pickup window. */
  checkPickupTime(pickupTime, listing) {
    const earliest = Math.max(listing.pickupStart.getTime(), Date.now() - PAST_TOLERANCE_MS)
    if (pickupTime.getTime() < earliest || pickupTime > listing.pickupEnd) {
      throw new ValidationError('Choose a pickup time inside the pickup window.', {
        pickupTime: 'Choose a time inside the pickup window.',
      })
    }
  }

  /** @private */
  canView(user, claim) {
    return user.role === 'admin' || refId(claim.rescuer) === user.id || refId(claim.donor) === user.id
  }
}
