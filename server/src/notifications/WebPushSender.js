/**
 * Adapter around the web-push library.
 *
 * For every message, web-push:
 * 1. encrypts the payload for the receiving browser (aes128gcm, RFC 8291)
 *    using the subscription's p256dh public key and auth secret, so the
 *    push service in the middle cannot read it;
 * 2. signs a VAPID JWT with our private key (RFC 8292), which proves to the
 *    push service that the message comes from this server.
 *
 * NotificationService only knows the small send() method below, so it can
 * be tested with a fake sender and the library can be swapped later.
 */
import { sendNotification } from 'web-push'

export class WebPushSender {
  /** @param {{ publicKey: string, privateKey: string, subject: string }} vapid */
  constructor(vapid) {
    this.vapid = vapid
  }

  get isConfigured() {
    return Boolean(this.vapid.publicKey && this.vapid.privateKey)
  }

  /**
   * @param {{ endpoint: string, keys: { p256dh: string, auth: string } }} subscription
   * @param {object} payload JSON-serialisable message for the service worker
   * @returns {Promise<{ statusCode: number }>}
   * @throws {import('web-push').WebPushError} with statusCode 404/410 when the subscription has expired
   */
  async send(subscription, payload) {
    return sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, JSON.stringify(payload), {
      vapidDetails: this.vapid,
      TTL: 60 * 60, // the push service keeps undelivered messages for 1 hour
      urgency: 'high',
      contentEncoding: 'aes128gcm',
    })
  }
}
