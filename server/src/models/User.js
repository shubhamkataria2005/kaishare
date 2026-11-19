/**
 * A KaiShare user.
 *
 * - donor:   a café, bakery, supermarket or caterer that lists surplus food
 * - rescuer: a charity, food bank or volunteer that claims and collects it
 * - admin:   moderates listings and can broadcast notifications
 *
 * A user signs up with email + password (authProvider "local") or with
 * Google (authProvider "google"). Google users have no password hash.
 */
import mongoose from 'mongoose'

export const ROLES = Object.freeze(['donor', 'rescuer', 'admin'])
export const SELF_SERVICE_ROLES = Object.freeze(['donor', 'rescuer'])

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // select: false keeps the hash out of every query unless asked for.
    passwordHash: { type: String, select: false },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ROLES, default: 'rescuer', index: true },
    organisation: { type: String, trim: true, maxlength: 120, default: '' },
    suburb: { type: String, trim: true, maxlength: 60, default: '' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
  },
  { timestamps: true },
)

/** The public shape of a user (never includes the password hash). */
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    authProvider: this.authProvider,
    organisation: this.organisation,
    suburb: this.suburb,
    phone: this.phone,
    createdAt: this.createdAt,
  }
}

export const User = mongoose.model('User', userSchema)
