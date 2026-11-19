import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { bearer, clearDatabase, makeAdmin, registerUser, startTestApp, stopTestApp } from '../helpers/testApp.js'

let app
let pushSender

const subscription = (n = 1) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`,
  expirationTime: null,
  keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
})

beforeAll(async () => {
  ;({ app, pushSender } = await startTestApp())
})
afterAll(stopTestApp)
beforeEach(async () => {
  await clearDatabase()
  pushSender.sent = []
  pushSender.failures.clear()
})

describe('push subscriptions', () => {
  it('publishes the VAPID public key without authentication', async () => {
    const res = await request(app).get('/api/push/public-key')
    expect(res.status).toBe(200)
    expect(res.body.publicKey).toBe('test-public-key')
  })

  it('saves a subscription once even if the browser subscribes twice', async () => {
    const { token } = await registerUser(app, 'rescuer')
    await request(app).post('/api/push/subscriptions').set(bearer(token)).send(subscription())
    const res = await request(app).post('/api/push/subscriptions').set(bearer(token)).send(subscription())
    expect(res.status).toBe(201)
    const status = await request(app).get('/api/push/status').set(bearer(token))
    expect(status.body).toEqual({ configured: true, subscriptions: 1 })
  })

  it('rejects a subscription with an http endpoint', async () => {
    const { token } = await registerUser(app, 'rescuer')
    const res = await request(app)
      .post('/api/push/subscriptions')
      .set(bearer(token))
      .send({ ...subscription(), endpoint: 'http://attacker.example/collect' })
    expect(res.status).toBe(400)
  })

  it('requires sign-in to subscribe', async () => {
    expect((await request(app).post('/api/push/subscriptions').send(subscription())).status).toBe(401)
  })

  it('removes a subscription', async () => {
    const { token } = await registerUser(app, 'rescuer')
    await request(app).post('/api/push/subscriptions').set(bearer(token)).send(subscription())
    const res = await request(app).delete('/api/push/subscriptions').set(bearer(token)).send({ endpoint: subscription().endpoint })
    expect(res.status).toBe(204)
    expect((await request(app).get('/api/push/status').set(bearer(token))).body.subscriptions).toBe(0)
  })
})

describe('sending notifications', () => {
  it('sends a test notification to the user\'s own devices', async () => {
    const { token } = await registerUser(app, 'rescuer')
    await request(app).post('/api/push/subscriptions').set(bearer(token)).send(subscription(1))
    await request(app).post('/api/push/subscriptions').set(bearer(token)).send(subscription(2))
    const res = await request(app).post('/api/push/test').set(bearer(token))
    expect(res.body).toMatchObject({ sent: 2, failed: 0 })
    expect(pushSender.sent[0].payload).toMatchObject({ title: 'KaiShare test notification', url: '/profile' })
  })

  it('drops a subscription that the push service reports as expired', async () => {
    const { token } = await registerUser(app, 'rescuer')
    await request(app).post('/api/push/subscriptions').set(bearer(token)).send(subscription(1))
    pushSender.failures.set(subscription(1).endpoint, 410)
    const res = await request(app).post('/api/push/test').set(bearer(token))
    expect(res.body).toMatchObject({ sent: 0, removed: 1 })
  })

  it('lets only an admin broadcast', async () => {
    const rescuer = await registerUser(app, 'rescuer')
    await request(app).post('/api/push/subscriptions').set(bearer(rescuer.token)).send(subscription(1))
    const body = { title: 'Storm warning', body: 'Pickups may be delayed today.', url: '/' }

    expect((await request(app).post('/api/push/broadcast').set(bearer(rescuer.token)).send(body)).status).toBe(403)

    const other = await registerUser(app, 'donor')
    const adminToken = await makeAdmin(app, other.user.id)
    const res = await request(app).post('/api/push/broadcast').set(bearer(adminToken)).send(body)
    expect(res.status).toBe(200)
    expect(res.body.sent).toBe(1)
  })
})
