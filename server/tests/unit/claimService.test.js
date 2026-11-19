/**
 * ClaimService with in-memory fake repositories: checks the business rules
 * without a database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaimService, refId } from '../../src/services/ClaimService.js'
import { ConflictError, ForbiddenError, ValidationError } from '../../src/utils/errors.js'

const HOUR = 60 * 60 * 1000
const id = (value) => ({ toString: () => value })
const rescuer = { id: 'rescuer-1', role: 'rescuer', name: 'Tama' }
const donor = { id: 'donor-1', role: 'donor', name: 'Mere' }

function makeListing(overrides = {}) {
  return {
    id: 'listing-1',
    donor: id('donor-1'),
    status: 'available',
    pickupStart: new Date(Date.now() - HOUR),
    pickupEnd: new Date(Date.now() + 3 * HOUR),
    ...overrides,
  }
}

function setup(listing = makeListing()) {
  const claim = {
    id: 'claim-1',
    listing: id('listing-1'),
    rescuer: id('rescuer-1'),
    donor: id('donor-1'),
    status: 'pending',
    toPublic() {
      return { id: 'claim-1', donorId: 'donor-1', status: this.status }
    },
  }
  const listings = {
    findById: vi.fn(async () => listing),
    transitionStatus: vi.fn(async (_id, from) => (listing.status === from ? { ...listing } : null)),
  }
  const claims = {
    create: vi.fn(async () => claim),
    findById: vi.fn(async () => claim),
    findByIdPopulated: vi.fn(async () => claim),
    updateById: vi.fn(async (_id, changes) => Object.assign(claim, changes)),
    deleteById: vi.fn(async () => claim),
  }
  const eventBus = { publish: vi.fn() }
  return { service: new ClaimService({ claims, listings, eventBus }), claims, listings, eventBus, claim }
}

describe('ClaimService.create', () => {
  let ctx
  beforeEach(() => {
    ctx = setup()
  })

  it('reserves the listing, creates a pending claim and publishes an event', async () => {
    const pickupTime = new Date(Date.now() + HOUR)
    const result = await ctx.service.create(rescuer, { listingId: 'listing-1', pickupTime, note: 'Van' })
    expect(ctx.listings.transitionStatus).toHaveBeenCalledWith('listing-1', 'available', 'reserved')
    expect(ctx.claims.create).toHaveBeenCalledWith(expect.objectContaining({ rescuer: 'rescuer-1', status: 'pending' }))
    expect(result.status).toBe('pending')
    expect(ctx.eventBus.publish).toHaveBeenCalledWith('claim.created', expect.anything())
  })

  it('rejects a pickup time outside the window', async () => {
    const pickupTime = new Date(Date.now() + 5 * HOUR)
    await expect(ctx.service.create(rescuer, { listingId: 'listing-1', pickupTime })).rejects.toThrow(ValidationError)
    expect(ctx.listings.transitionStatus).not.toHaveBeenCalled()
  })

  it('returns 409 when another rescuer reserved the listing first', async () => {
    ctx.listings.transitionStatus.mockResolvedValueOnce(null)
    const pickupTime = new Date(Date.now() + HOUR)
    await expect(ctx.service.create(rescuer, { listingId: 'listing-1', pickupTime })).rejects.toThrow(ConflictError)
    expect(ctx.claims.create).not.toHaveBeenCalled()
  })

  it('releases the reservation again if saving the claim fails', async () => {
    ctx.claims.create.mockRejectedValueOnce(new Error('write failed'))
    ctx.listings.transitionStatus.mockResolvedValue({})
    const pickupTime = new Date(Date.now() + HOUR)
    await expect(ctx.service.create(rescuer, { listingId: 'listing-1', pickupTime })).rejects.toThrow('write failed')
    expect(ctx.listings.transitionStatus).toHaveBeenLastCalledWith('listing-1', 'reserved', 'available')
  })

  it('rejects a listing whose pickup window has closed', async () => {
    ctx = setup(makeListing({ pickupEnd: new Date(Date.now() - HOUR), pickupStart: new Date(Date.now() - 3 * HOUR) }))
    await expect(ctx.service.create(rescuer, { listingId: 'listing-1', pickupTime: new Date() })).rejects.toThrow(/closed/)
  })
})

describe('ClaimService.update', () => {
  it('lets the donor confirm a pending claim', async () => {
    const ctx = setup(makeListing({ status: 'reserved' }))
    await ctx.service.update(donor, 'claim-1', { status: 'confirmed' })
    expect(ctx.claims.updateById).toHaveBeenCalledWith('claim-1', { status: 'confirmed' })
    expect(ctx.eventBus.publish).toHaveBeenCalledWith('claim.statusChanged', expect.objectContaining({ to: 'confirmed' }))
  })

  it('does not let the rescuer confirm their own claim', async () => {
    const ctx = setup()
    await expect(ctx.service.update(rescuer, 'claim-1', { status: 'confirmed' })).rejects.toThrow(ForbiddenError)
  })

  it('does not let the donor change the pickup time', async () => {
    const ctx = setup()
    await expect(ctx.service.update(donor, 'claim-1', { pickupTime: new Date() })).rejects.toThrow(ForbiddenError)
  })

  it('rejects jumping from pending straight to collected', async () => {
    const ctx = setup()
    await expect(ctx.service.update(donor, 'claim-1', { status: 'collected' })).rejects.toThrow(ConflictError)
  })
})

describe('ClaimService.remove', () => {
  it('deletes an active claim and frees the listing', async () => {
    const ctx = setup()
    await ctx.service.remove(rescuer, 'claim-1')
    expect(ctx.claims.deleteById).toHaveBeenCalledWith('claim-1')
    expect(ctx.listings.transitionStatus).toHaveBeenCalledWith('listing-1', 'reserved', 'available')
    expect(ctx.eventBus.publish).toHaveBeenCalledWith('claim.cancelled', expect.objectContaining({ donorId: 'donor-1' }))
  })

  it('keeps collected claims as a record', async () => {
    const ctx = setup()
    ctx.claim.status = 'collected'
    await expect(ctx.service.remove(rescuer, 'claim-1')).rejects.toThrow(ConflictError)
  })
})

describe('refId', () => {
  it('returns the id of a plain or a populated reference', () => {
    expect(refId(id('u1'))).toBe('u1')
    expect(refId({ _id: id('u2'), name: 'Tama' })).toBe('u2')
    expect(refId(undefined)).toBeUndefined()
  })
})
