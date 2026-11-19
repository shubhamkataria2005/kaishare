/**
 * A refresh-token session.
 *
 * Only a SHA-256 hash of the refresh token is stored, so a database leak
 * does not reveal usable tokens. Each token belongs to a "family" (one
 * sign-in). Tokens are rotated on every refresh; if an already-used token is
 * presented again, someone has copied it, so the whole family is revoked.
 *
 * The TTL index lets MongoDB delete sessions automatically once expired.
 */
import mongoose from 'mongoose'

const refreshSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, maxlength: 300, default: '' },
  },
  { timestamps: true },
)

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema)
