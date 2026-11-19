/**
 * Repository pattern: the only layer that talks to Mongoose.
 *
 * Services depend on repositories, not on Mongoose models, so:
 * - the database (or the ODM) can be swapped by writing a new repository,
 * - services can be unit tested with simple in-memory fakes,
 * - every query lives in one place, where its indexes are easy to check.
 *
 * BaseRepository holds the generic CRUD operations; each concrete
 * repository adds the queries its feature needs (Template/inheritance).
 */
import mongoose from 'mongoose'

export class BaseRepository {
  /** @param {mongoose.Model} model */
  constructor(model) {
    this.model = model
  }

  /** True when `id` is a valid ObjectId (avoids a CastError for bad ids). */
  static isValidId(id) {
    return typeof id === 'string' && mongoose.isValidObjectId(id)
  }

  async create(data) {
    return this.model.create(data)
  }

  async findById(id, { populate } = {}) {
    if (!BaseRepository.isValidId(id)) return null
    const query = this.model.findById(id)
    if (populate) query.populate(populate)
    return query.exec()
  }

  async findOne(filter) {
    return this.model.findOne(filter).exec()
  }

  /**
   * Applies `changes` and returns the updated document. Schema validators
   * run on updates too (runValidators), so an update cannot store values a
   * create would reject.
   */
  async updateById(id, changes) {
    if (!BaseRepository.isValidId(id)) return null
    return this.model.findByIdAndUpdate(id, changes, { returnDocument: 'after', runValidators: true }).exec()
  }

  async deleteById(id) {
    if (!BaseRepository.isValidId(id)) return null
    return this.model.findByIdAndDelete(id).exec()
  }

  async count(filter = {}) {
    return this.model.countDocuments(filter).exec()
  }
}
