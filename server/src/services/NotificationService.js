/**
 * Stores push subscriptions and sends notifications to users.
 */
import { ValidationError } from '../utils/errors.js'

// Push services answer 404 or 410 when a subscription no longer exists
// (the user blocked notifications or cleared site data).
const GONE_STATUS_CODES = new Set([404, 410])

export class NotificationService {
  /**
   * @param {{
   *   subscriptions: import('../repositories/PushSubscriptionRepository.js').PushSubscriptionRepository,
   *   users: import('../repositories/UserRepository.js').UserRepository,
   *   sender: { isConfigured: boolean, send(subscription: object, payload: object): Promise<unknown> },
   *   publicKey: string,
   *   logger: import('winston').Logger,
   * }} deps
   */
  constructor({ subscriptions, users, sender, publicKey, logger }) {
    this.subscriptions = subscriptions
    this.users = users
    this.sender = sender
    this.publicKey = publicKey
    this.logger = logger
  }

  getPublicKey() {
    if (!this.sender.isConfigured) {
      throw new ValidationError('Push notifications are not configured on this server.')
    }
    return this.publicKey
  }

  async subscribe(userId, subscription, userAgent = '') {
    await this.subscriptions.upsert(userId, subscription, userAgent.slice(0, 300))
    this.logger.info('Push subscription saved', { userId })
  }

  async unsubscribe(userId, endpoint) {
    const { deletedCount } = await this.subscriptions.deleteByEndpoint(endpoint, userId)
    return deletedCount > 0
  }

  async countForUser(userId) {
    return (await this.subscriptions.findByUser(userId)).length
  }

  /**
   * Sends one payload to every device of the given users.
   *
   * @param {string[]} userIds
   * @param {{ title: string, body: string, url?: string, tag?: string }} payload
   * @returns {Promise<{ sent: number, failed: number, removed: number }>}
   */
  async sendToUsers(userIds, payload) {
    const summary = { sent: 0, failed: 0, removed: 0 }
    if (!this.sender.isConfigured || userIds.length === 0) return summary

    const subscriptions = await this.subscriptions.findByUsers(userIds)
    const message = { url: '/', ...payload, sentAt: new Date().toISOString() }

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await this.sender.send(subscription, message)
          summary.sent += 1
        } catch (error) {
          if (GONE_STATUS_CODES.has(error.statusCode)) {
            await this.subscriptions.deleteByEndpoint(subscription.endpoint)
            summary.removed += 1
          } else {
            summary.failed += 1
            this.logger.warn('Push message failed', { statusCode: error.statusCode, error: error.message })
          }
        }
      }),
    )

    this.logger.info(`Push "${payload.title}" sent`, summary)
    return summary
  }

  /** Sends to every user with one of the roles, optionally skipping one user. */
  async sendToRoles(roles, payload, { excludeUserId } = {}) {
    const userIds = (await this.users.findIdsByRoles(roles)).filter((id) => id !== excludeUserId)
    return this.sendToUsers(userIds, payload)
  }
}
