/**
 * Observer pattern: a small publish/subscribe event bus.
 *
 * Services publish domain events ("a listing was created", "a claim was
 * confirmed") without knowing who listens. Listeners such as the push
 * notification subscriber register themselves in the composition root.
 * New reactions (emails, SMS, analytics) can be added later by subscribing
 * another listener, without touching the services (Open/Closed principle).
 *
 * Listeners run asynchronously after the request has been answered, and a
 * failing listener is logged instead of breaking the request that published
 * the event.
 */
import { logger } from '../utils/logger.js'

export const EVENTS = Object.freeze({
  LISTING_CREATED: 'listing.created',
  LISTING_UPDATED: 'listing.updated',
  LISTING_DELETED: 'listing.deleted',
  CLAIM_CREATED: 'claim.created',
  CLAIM_UPDATED: 'claim.updated',
  CLAIM_STATUS_CHANGED: 'claim.statusChanged',
  CLAIM_CANCELLED: 'claim.cancelled',
})

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<(payload: unknown) => unknown>>} */
    this.listeners = new Map()
  }

  /**
   * Registers a listener and returns a function that removes it again.
   *
   * @param {string} eventName
   * @param {(payload: any) => unknown} listener
   */
  subscribe(eventName, listener) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set())
    this.listeners.get(eventName).add(listener)
    return () => this.listeners.get(eventName)?.delete(listener)
  }

  /**
   * Notifies every listener of `eventName`. Returns a promise that settles
   * when all listeners have finished, which tests can await; the app itself
   * does not wait for it.
   *
   * @param {string} eventName
   * @param {unknown} payload
   */
  publish(eventName, payload) {
    const listeners = [...(this.listeners.get(eventName) ?? [])]
    logger.debug(`Event ${eventName} -> ${listeners.length} listener(s)`)

    return Promise.allSettled(
      listeners.map(async (listener) => {
        try {
          await listener(payload)
        } catch (error) {
          logger.error(`Listener for ${eventName} failed`, { error: error.message })
          throw error
        }
      }),
    )
  }
}
