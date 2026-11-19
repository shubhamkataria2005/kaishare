import { RefreshSession } from '../models/RefreshSession.js'
import { BaseRepository } from './BaseRepository.js'

export class RefreshSessionRepository extends BaseRepository {
  constructor() {
    super(RefreshSession)
  }

  async findByHash(tokenHash) {
    return this.model.findOne({ tokenHash }).exec()
  }

  /**
   * Marks a session as used, but only if it has not been used yet.
   * Returns null when another request already used it (token reuse).
   */
  async markUsed(id) {
    return this.model.findOneAndUpdate({ _id: id, usedAt: null }, { usedAt: new Date() }, { returnDocument: 'after' }).exec()
  }

  async revokeFamily(family) {
    await this.model.updateMany({ family, revokedAt: null }, { revokedAt: new Date() }).exec()
  }

  async revokeAllForUser(userId) {
    await this.model.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() }).exec()
  }
}
