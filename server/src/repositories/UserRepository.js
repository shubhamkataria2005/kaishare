import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { BaseRepository } from './BaseRepository.js'

export class UserRepository extends BaseRepository {
  constructor() {
    super(User)
  }

  async findByEmail(email, { withPassword = false } = {}) {
    const query = this.model.findOne({ email: String(email).toLowerCase() })
    if (withPassword) query.select('+passwordHash')
    return query.exec()
  }

  async findByGoogleId(googleId) {
    return this.model.findOne({ googleId }).exec()
  }

  /** Ids of every user with one of the given roles (for notifications). */
  async findIdsByRoles(roles) {
    const users = await this.model.find({ role: mongoose.trusted({ $in: roles }) }, { _id: 1 }).lean()
    return users.map((user) => user._id.toString())
  }
}
