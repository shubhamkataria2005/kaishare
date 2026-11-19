import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { bearer, clearDatabase, inHours, listingBody, makeAdmin, registerUser, startTestApp, stopTestApp } from '../helpers/testApp.js'

let app
let pushSender
let donor
let otherDonor
let rescuer

beforeAll(async () => {
  ;({ app, pushSender } = await startTestApp())
})
afterAll(stopTestApp)
beforeEach(async () => {
  await clearDatabase()
  pushSender.sent = []
  donor = await registerUser(app, 'donor')
  otherDonor = await registerUser(app, 'donor')
  rescuer = await registerUser(app, 'rescuer')
})

const createListing = (token, overrides) => request(app).post('/api/listings').set(bearer(token)).send(listingBody(overrides))

describe('POST /api/listings (create)', () => {
  it('lets a donor create a listing', async () => {
    const res = await createListing(donor.token)
    expect(res.status).toBe(201)
    expect(res.headers.location).toBe(`/api/listings/${res.body.listing.id}`)
    expect(res.body.listing).toMatchObject({ title: 'Sourdough loaves', status: 'available', donorId: donor.user.id })
  })

  it('does not let a rescuer create a listing', async () => {
    expect((await createListing(rescuer.token)).status).toBe(403)
  })

  it('rejects a listing without a token', async () => {
    expect((await request(app).post('/api/listings').send(listingBody())).status).toBe(401)
  })

  it('returns field errors for an invalid listing', async () => {
    const res = await createListing(donor.token, { quantity: -3, unit: 'tonnes' })
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['quantity', 'unit']))
  })

  it('ignores a donor id in the body (the donor is always the signed-in user)', async () => {
    const res = await createListing(donor.token, { donor: otherDonor.user.id, status: 'collected' })
    expect(res.body.listing.donorId).toBe(donor.user.id)
    expect(res.body.listing.status).toBe('available')
  })
})

describe('GET /api/listings (read)', () => {
  beforeEach(async () => {
    await createListing(donor.token)
    await createListing(donor.token, { title: 'Vegetable curry', category: 'prepared-meals', suburb: 'Newton' })
    await createListing(otherDonor.token, { title: 'Apples', category: 'produce', suburb: 'Grey Lynn' })
  })

  it('lists open listings for any signed-in user', async () => {
    const res = await request(app).get('/api/listings').set(bearer(rescuer.token))
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
  })

  it('filters by category and suburb (case-insensitive)', async () => {
    const byCategory = await request(app).get('/api/listings?category=produce').set(bearer(rescuer.token))
    expect(byCategory.body.items.map((item) => item.title)).toEqual(['Apples'])
    const bySuburb = await request(app).get('/api/listings?suburb=newton').set(bearer(rescuer.token))
    expect(bySuburb.body.items.map((item) => item.title)).toEqual(['Vegetable curry'])
  })

  it('finds listings by text search', async () => {
    const res = await request(app).get('/api/listings?q=curry').set(bearer(rescuer.token))
    expect(res.body.items.map((item) => item.title)).toEqual(['Vegetable curry'])
  })

  it('pages the results', async () => {
    const res = await request(app).get('/api/listings?limit=2&page=2').set(bearer(rescuer.token))
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 })
    expect(res.body.items).toHaveLength(1)
  })

  it('treats regex characters in the suburb filter literally', async () => {
    const res = await request(app).get('/api/listings?suburb=.*').set(bearer(rescuer.token))
    expect(res.body.total).toBe(0)
  })

  it('shows a donor only their own listings on /mine', async () => {
    const res = await request(app).get('/api/listings/mine').set(bearer(donor.token))
    expect(res.body.items).toHaveLength(2)
  })

  it('returns 400 for a malformed id and 404 for an unknown one', async () => {
    expect((await request(app).get('/api/listings/123').set(bearer(rescuer.token))).status).toBe(400)
    expect((await request(app).get('/api/listings/665f1c2b9a1e4b0012345678').set(bearer(rescuer.token))).status).toBe(404)
  })
})

describe('PATCH /api/listings/:id (update)', () => {
  it('lets the owner update their listing', async () => {
    const { body } = await createListing(donor.token)
    const res = await request(app).patch(`/api/listings/${body.listing.id}`).set(bearer(donor.token)).send({ quantity: 6 })
    expect(res.status).toBe(200)
    expect(res.body.listing.quantity).toBe(6)
  })

  it('does not let another donor update it', async () => {
    const { body } = await createListing(donor.token)
    const res = await request(app).patch(`/api/listings/${body.listing.id}`).set(bearer(otherDonor.token)).send({ quantity: 1 })
    expect(res.status).toBe(403)
  })

  it('checks the pickup window against the existing values', async () => {
    const { body } = await createListing(donor.token)
    const res = await request(app)
      .patch(`/api/listings/${body.listing.id}`)
      .set(bearer(donor.token))
      .send({ pickupEnd: inHours(-2) })
    expect(res.status).toBe(400)
    expect(res.body.errors.pickupEnd).toBeTruthy()
  })

  it('lets an admin update any listing', async () => {
    const { body } = await createListing(donor.token)
    const adminToken = await makeAdmin(app, otherDonor.user.id)
    const res = await request(app).patch(`/api/listings/${body.listing.id}`).set(bearer(adminToken)).send({ title: 'Moderated title' })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/listings/:id (delete)', () => {
  it('lets the owner delete an available listing', async () => {
    const { body } = await createListing(donor.token)
    const res = await request(app).delete(`/api/listings/${body.listing.id}`).set(bearer(donor.token))
    expect(res.status).toBe(204)
    expect((await request(app).get(`/api/listings/${body.listing.id}`).set(bearer(donor.token))).status).toBe(404)
  })

  it('refuses to delete a listing with an active claim', async () => {
    const { body } = await createListing(donor.token)
    await request(app).post('/api/claims').set(bearer(rescuer.token)).send({ listingId: body.listing.id, pickupTime: inHours(1) })
    const res = await request(app).delete(`/api/listings/${body.listing.id}`).set(bearer(donor.token))
    expect(res.status).toBe(409)
  })
})

describe('push notification on a new listing', () => {
  it('notifies rescuers (not the donor) when food is posted', async () => {
    const subscription = (n) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } })
    await request(app).post('/api/push/subscriptions').set(bearer(rescuer.token)).send(subscription(1))
    await request(app).post('/api/push/subscriptions').set(bearer(donor.token)).send(subscription(2))

    await createListing(donor.token)
    // Listeners run after the response; give them a moment to finish.
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(pushSender.sent).toHaveLength(1)
    expect(pushSender.sent[0].endpoint).toBe('https://push.example/1')
    expect(pushSender.sent[0].payload.title).toBe('New surplus food')
  })
})
