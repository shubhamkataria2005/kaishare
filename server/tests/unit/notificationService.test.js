import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationService } from '../../src/services/NotificationService.js'
import { ValidationError } from '../../src/utils/errors.js'

const logger = { info: vi.fn(), warn: vi.fn() }

function setup({ configured = true, failures = {} } = {}) {
  const subscriptions = {
    rows: [
      { user: 'u1', endpoint: 'https://push.example/1', keys: {} },
      { user: 'u1', endpoint: 'https://push.example/2', keys: {} },
      { user: 'u2', endpoint: 'https://push.example/3', keys: {} },
    ],
    findByUsers: vi.fn(async function (ids) {
      return this.rows.filter((row) => ids.includes(row.user))
    }),
    deleteByEndpoint: vi.fn(async () => ({ deletedCount: 1 })),
  }
  const users = { findIdsByRoles: vi.fn(async () => ['u1', 'u2']) }
  const sender = {
    isConfigured: configured,
    send: vi.fn(async (subscription) => {
      const statusCode = failures[subscription.endpoint]
      if (statusCode) throw Object.assign(new Error('failed'), { statusCode })
    }),
  }
  const service = new NotificationService({ subscriptions, users, sender, publicKey: 'PUBLIC', logger })
  return { service, subscriptions, users, sender }
}

describe('NotificationService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends the payload to every device of the user', async () => {
    const { service, sender } = setup()
    const result = await service.sendToUsers(['u1'], { title: 'Hi', body: 'There' })
    expect(result).toEqual({ sent: 2, failed: 0, removed: 0 })
    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/1' }),
      expect.objectContaining({ title: 'Hi', body: 'There', url: '/' }),
    )
  })

  it('deletes subscriptions the push service says are gone (410)', async () => {
    const { service, subscriptions } = setup({ failures: { 'https://push.example/2': 410 } })
    const result = await service.sendToUsers(['u1'], { title: 'Hi', body: 'There' })
    expect(result).toEqual({ sent: 1, failed: 0, removed: 1 })
    expect(subscriptions.deleteByEndpoint).toHaveBeenCalledWith('https://push.example/2')
  })

  it('counts other failures without deleting the subscription', async () => {
    const { service, subscriptions } = setup({ failures: { 'https://push.example/1': 500 } })
    const result = await service.sendToUsers(['u1'], { title: 'Hi', body: 'There' })
    expect(result).toEqual({ sent: 1, failed: 1, removed: 0 })
    expect(subscriptions.deleteByEndpoint).not.toHaveBeenCalled()
  })

  it('skips the excluded user when sending to a role', async () => {
    const { service, subscriptions } = setup()
    await service.sendToRoles(['rescuer'], { title: 'New food', body: '...' }, { excludeUserId: 'u1' })
    expect(subscriptions.findByUsers).toHaveBeenCalledWith(['u2'])
  })

  it('does nothing when VAPID keys are not configured', async () => {
    const { service, sender } = setup({ configured: false })
    expect(await service.sendToUsers(['u1'], { title: 'Hi', body: 'There' })).toEqual({ sent: 0, failed: 0, removed: 0 })
    expect(sender.send).not.toHaveBeenCalled()
    expect(() => service.getPublicKey()).toThrow(ValidationError)
  })
})
