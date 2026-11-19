import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { bearer, clearDatabase, inHours, listingBody, registerUser, startTestApp, stopTestApp } from '../helpers/testApp.js'

let app
let donor
let rescuer
let otherRescuer
let listingId

beforeAll(async () => {
  ;({ app } = await startTestApp())
})
afterAll(stopTestApp)
beforeEach(async () => {
  await clearDatabase()
  donor = await registerUser(app, 'donor')
  rescuer = await registerUser(app, 'rescuer')
  otherRescuer = await registerUser(app, 'rescuer')
  const res = await request(app).post('/api/listings').set(bearer(donor.token)).send(listingBody())
  listingId = res.body.listing.id
})

const claim = (token, body = {}) =>
  request(app).post('/api/claims').set(bearer(token)).send({ listingId, pickupTime: inHours(1), note: 'Bringing crates', ...body })

const listingStatus = async () => (await request(app).get(`/api/listings/${listingId}`).set(bearer(donor.token))).body.listing.status

describe('POST /api/claims (create)', () => {
  it('creates a pending claim and reserves the listing', async () => {
    const res = await claim(rescuer.token)
    expect(res.status).toBe(201)
    expect(res.body.claim).toMatchObject({ status: 'pending', rescuerId: rescuer.user.id, listing: { title: 'Sourdough loaves' } })
    expect(await listingStatus()).toBe('reserved')
  })

  it('returns 409 when the listing has already been claimed', async () => {
    await claim(rescuer.token)
    const res = await claim(otherRescuer.token)
    expect(res.status).toBe(409)
  })

  it('lets only one of two simultaneous claims succeed', async () => {
    const results = await Promise.all([claim(rescuer.token), claim(otherRescuer.token)])
    expect(results.map((res) => res.status).sort()).toEqual([201, 409])
  })

  it('rejects a pickup time outside the pickup window', async () => {
    const res = await claim(rescuer.token, { pickupTime: inHours(10) })
    expect(res.status).toBe(400)
    expect(res.body.errors.pickupTime).toBeTruthy()
  })

  it('does not let a donor make a claim', async () => {
    expect((await claim(donor.token)).status).toBe(403)
  })
})

describe('GET /api/claims (read)', () => {
  it('shows the rescuer their claims and the donor the claims on their listings', async () => {
    await claim(rescuer.token)
    const mine = await request(app).get('/api/claims').set(bearer(rescuer.token))
    const incoming = await request(app).get('/api/claims').set(bearer(donor.token))
    const other = await request(app).get('/api/claims').set(bearer(otherRescuer.token))
    expect(mine.body.items).toHaveLength(1)
    expect(incoming.body.items).toHaveLength(1)
    expect(other.body.items).toHaveLength(0)
  })

  it('shows a claim to its rescuer and to the donor', async () => {
    const { body } = await claim(rescuer.token)
    const asRescuer = await request(app).get(`/api/claims/${body.claim.id}`).set(bearer(rescuer.token))
    const asDonor = await request(app).get(`/api/claims/${body.claim.id}`).set(bearer(donor.token))
    expect(asRescuer.status).toBe(200)
    expect(asRescuer.body.claim.note).toBe('Bringing crates')
    expect(asDonor.status).toBe(200)
  })

  it('hides a claim from users who are not part of it (404)', async () => {
    const { body } = await claim(rescuer.token)
    const res = await request(app).get(`/api/claims/${body.claim.id}`).set(bearer(otherRescuer.token))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/claims/:id (update)', () => {
  it('lets the rescuer change the pickup time and note', async () => {
    const { body } = await claim(rescuer.token)
    const pickupTime = inHours(2)
    const res = await request(app).patch(`/api/claims/${body.claim.id}`).set(bearer(rescuer.token)).send({ pickupTime, note: 'Running late' })
    expect(res.status).toBe(200)
    expect(res.body.claim).toMatchObject({ pickupTime, note: 'Running late' })
  })

  it('runs the full donor flow: confirm, then collected', async () => {
    const { body } = await claim(rescuer.token)
    const url = `/api/claims/${body.claim.id}`
    const confirmed = await request(app).patch(url).set(bearer(donor.token)).send({ status: 'confirmed' })
    expect(confirmed.body.claim.status).toBe('confirmed')
    const collected = await request(app).patch(url).set(bearer(donor.token)).send({ status: 'collected' })
    expect(collected.body.claim.status).toBe('collected')
    expect(await listingStatus()).toBe('collected')
  })

  it('makes the listing available again when the donor declines', async () => {
    const { body } = await claim(rescuer.token)
    await request(app).patch(`/api/claims/${body.claim.id}`).set(bearer(donor.token)).send({ status: 'declined' })
    expect(await listingStatus()).toBe('available')
  })

  it('rejects an illegal status change with 409', async () => {
    const { body } = await claim(rescuer.token)
    const res = await request(app).patch(`/api/claims/${body.claim.id}`).set(bearer(donor.token)).send({ status: 'collected' })
    expect(res.status).toBe(409)
  })

  it('does not let the rescuer confirm their own claim', async () => {
    const { body } = await claim(rescuer.token)
    const res = await request(app).patch(`/api/claims/${body.claim.id}`).set(bearer(rescuer.token)).send({ status: 'confirmed' })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/claims/:id (delete)', () => {
  it('cancels the claim and frees the listing', async () => {
    const { body } = await claim(rescuer.token)
    const res = await request(app).delete(`/api/claims/${body.claim.id}`).set(bearer(rescuer.token))
    expect(res.status).toBe(204)
    expect(await listingStatus()).toBe('available')
    // Another rescuer can now claim it.
    expect((await claim(otherRescuer.token)).status).toBe(201)
  })

  it('does not let another rescuer cancel it', async () => {
    const { body } = await claim(rescuer.token)
    const res = await request(app).delete(`/api/claims/${body.claim.id}`).set(bearer(otherRescuer.token))
    expect(res.status).toBe(404)
  })

  it('keeps a collected claim', async () => {
    const { body } = await claim(rescuer.token)
    const url = `/api/claims/${body.claim.id}`
    await request(app).patch(url).set(bearer(donor.token)).send({ status: 'confirmed' })
    await request(app).patch(url).set(bearer(donor.token)).send({ status: 'collected' })
    expect((await request(app).delete(url).set(bearer(rescuer.token))).status).toBe(409)
  })
})
