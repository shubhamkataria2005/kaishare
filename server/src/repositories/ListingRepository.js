import mongoose from 'mongoose'
import { Listing } from '../models/Listing.js'
import { BaseRepository } from './BaseRepository.js'

const DONOR_FIELDS = 'name organisation'

/*
 * Mongoose's sanitizeFilter (switched on in config/database.js) wraps any
 * object with a "$" key in $eq, which blocks injected operators. Operators
 * written here in the code itself are marked with mongoose.trusted() so they
 * keep working; values from the request are only ever plain strings that
 * Zod has already validated.
 */

/** Escapes every character that has a special meaning in a regular expression. */
export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export class ListingRepository extends BaseRepository {
  constructor() {
    super(Listing)
  }

  async findByIdWithDonor(id) {
    return this.findById(id, { populate: { path: 'donor', select: DONOR_FIELDS } })
  }

  /**
   * Open listings for the browse page: available and not yet past their
   * pickup window, soonest window first.
   *
   * @param {{ category?: string, suburb?: string, search?: string, page: number, limit: number, now?: Date }} options
   */
  async findOpen({ category, suburb, search, page, limit, now = new Date() }) {
    const filter = { status: 'available', pickupEnd: mongoose.trusted({ $gte: now }) }
    if (category) filter.category = category
    // Case-insensitive exact match ("ponsonby" finds "Ponsonby"). The value
    // is escaped so characters such as ".*" are matched literally.
    if (suburb) filter.suburb = new RegExp(`^${escapeRegExp(suburb)}$`, 'i')
    if (search) filter.$text = mongoose.trusted({ $search: search })

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ pickupEnd: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('donor', DONOR_FIELDS)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ])
    return { items, total, page, limit }
  }

  /** Every listing a donor has posted, newest first. */
  async findByDonor(donorId) {
    return this.model.find({ donor: donorId }).sort({ createdAt: -1 }).populate('donor', DONOR_FIELDS).exec()
  }

  /**
   * Atomically moves a listing from one status to another.
   *
   * The status is part of the filter, so if two rescuers claim the same
   * listing at the same moment only one update matches; the other gets
   * null back. This avoids a read-then-write race without a transaction.
   */
  async transitionStatus(id, fromStatus, toStatus) {
    if (!BaseRepository.isValidId(id)) return null
    return this.model
      .findOneAndUpdate({ _id: id, status: fromStatus }, { status: toStatus }, { returnDocument: 'after' })
      .exec()
  }
}
