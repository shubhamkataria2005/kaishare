import { describe, expect, it, vi } from 'vitest'
import { EventBus } from '../../src/events/EventBus.js'

describe('EventBus', () => {
  it('delivers a payload to every subscriber of the event', async () => {
    const bus = new EventBus()
    const first = vi.fn()
    const second = vi.fn()
    bus.subscribe('listing.created', first)
    bus.subscribe('listing.created', second)
    await bus.publish('listing.created', { id: 'L1' })
    expect(first).toHaveBeenCalledWith({ id: 'L1' })
    expect(second).toHaveBeenCalledWith({ id: 'L1' })
  })

  it('does not deliver other events', async () => {
    const bus = new EventBus()
    const listener = vi.fn()
    bus.subscribe('claim.created', listener)
    await bus.publish('listing.created', {})
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops delivering after unsubscribe', async () => {
    const bus = new EventBus()
    const listener = vi.fn()
    const unsubscribe = bus.subscribe('claim.created', listener)
    unsubscribe()
    await bus.publish('claim.created', {})
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps going when one listener fails', async () => {
    const bus = new EventBus()
    const healthy = vi.fn()
    bus.subscribe('claim.created', () => {
      throw new Error('push service down')
    })
    bus.subscribe('claim.created', healthy)
    const results = await bus.publish('claim.created', {})
    expect(healthy).toHaveBeenCalled()
    expect(results.map((result) => result.status)).toEqual(['rejected', 'fulfilled'])
  })
})
