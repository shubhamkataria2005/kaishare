import mongoose from 'mongoose'
import { Claim } from '../models/Claim.js'
import { BaseRepository } from './BaseRepository.js'

const POPULATE = [
  { path: 'listing', select: 'title quantity unit address suburb pickupStart pickupEnd status' },
  { path: 'rescuer', select: 'name organisation' },
]

export class ClaimRepository extends BaseRepository {
  constructor() {
    super(Claim)
  }

  async findByIdPopulated(id) {
    return this.findById(id, { populate: POPULATE })
  }

  async findByRescuer(rescuerId) {
    return this.model.find({ rescuer: rescuerId }).sort({ createdAt: -1 }).populate(POPULATE).exec()
  }

  async findByDonor(donorId) {
    return this.model.find({ donor: donorId }).sort({ createdAt: -1 }).populate(POPULATE).exec()
  }

  async findAll() {
    return this.model.find().sort({ createdAt: -1 }).limit(200).populate(POPULATE).exec()
  }

  /** The claim that currently holds a listing (pending or confirmed), if any. */
  async findActiveForListing(listingId) {
    return this.model
      .findOne({ listing: listingId, status: mongoose.trusted({ $in: ['pending', 'confirmed'] }) })
      .exec()
  }

  async deleteByListing(listingId) {
    return this.model.deleteMany({ listing: listingId }).exec()
  }
}
