import mongoose from 'mongoose'
import { PushSubscription } from '../models/PushSubscription.js'
import { BaseRepository } from './BaseRepository.js'

export class PushSubscriptionRepository extends BaseRepository {
  constructor() {
    super(PushSubscription)
  }

  /**
   * Saves a subscription for a user. The endpoint is unique, so if the same
   * browser subscribes again (or another user signs in on it) the existing
   * record is updated instead of creating a duplicate.
   */
  async upsert(userId, { endpoint, keys }, userAgent = '') {
    return this.model
      .findOneAndUpdate(
        { endpoint },
        { user: userId, endpoint, keys, userAgent },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      )
      .exec()
  }

  async findByUsers(userIds) {
    return this.model.find({ user: mongoose.trusted({ $in: userIds }) }).lean()
  }

  async findByUser(userId) {
    return this.model.find({ user: userId }).lean()
  }

  async deleteByEndpoint(endpoint, userId) {
    const filter = userId ? { endpoint, user: userId } : { endpoint }
    return this.model.deleteOne(filter).exec()
  }
}
