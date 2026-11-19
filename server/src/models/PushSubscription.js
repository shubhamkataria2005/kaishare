/**
 * A browser's Web Push subscription.
 *
 * The browser's push service gives each subscription an endpoint URL and
 * two keys: p256dh (the browser's public ECDH key) and auth (a shared
 * secret). The server uses them to encrypt every message (RFC 8291), so
 * only that browser can read it; the push service only sees ciphertext.
 */
import mongoose from 'mongoose'

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, maxlength: 300, default: '' },
  },
  { timestamps: true },
)

export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema)
