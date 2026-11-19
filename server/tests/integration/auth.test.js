import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { bearer, clearDatabase, registerUser, startTestApp, stopTestApp } from '../helpers/testApp.js'

let app

beforeAll(async () => {
  ;({ app } = await startTestApp())
})
afterAll(stopTestApp)
beforeEach(clearDatabase)

/** The refresh-token cookie from a response, e.g. "kaishare_rt=abc". */
const refreshCookie = (res) => res.headers['set-cookie']?.find((cookie) => cookie.startsWith('kaishare_rt='))
const cookiePair = (res) => refreshCookie(res).split(';')[0]

const registration = {
  name: 'Mere Thompson',
  email: 'mere@example.com',
  password: 'Bread2026',
  confirmPassword: 'Bread2026',
  role: 'donor',
  organisation: 'Ponsonby Bakehouse',
}

describe('POST /api/auth/register', () => {
  it('creates the account, returns an access token and sets the refresh cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(registration)
    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({ name: 'Mere Thompson', email: 'mere@example.com', role: 'donor' })
    expect(res.body.accessToken.split('.')).toHaveLength(3)
    // The password hash and the refresh token are never in the body.
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|refreshToken/)
  })

  it('sets the refresh cookie as httpOnly, SameSite=Strict and scoped to /api/auth', async () => {
    const res = await request(app).post('/api/auth/register').send(registration)
    const cookie = refreshCookie(res)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Strict/)
    expect(cookie).toMatch(/Path=\/api\/auth/)
  })

  it('returns 409 for an email that is already registered', async () => {
    await request(app).post('/api/auth/register').send(registration)
    const res = await request(app).post('/api/auth/register').send({ ...registration, email: 'MERE@example.com' })
    expect(res.status).toBe(409)
  })

  it('returns 400 with field errors for invalid input', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...registration, email: 'nope', confirmPassword: 'x' })
    expect(res.status).toBe(400)
    expect(res.body.errors).toMatchObject({ email: 'Enter a valid email address.', confirmPassword: 'Passwords do not match.' })
  })

  it('ignores an attempt to register as admin through extra fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...registration, role: 'admin' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(registration)
  })

  it('signs in with the right password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'mere@example.com', password: 'Bread2026' })
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('mere@example.com')
  })

  it('returns 401 with a generic message for a wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'mere@example.com', password: 'Wrong2026' })
    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Email or password is incorrect.')
  })

  it('blocks a NoSQL injection attempt in the email field', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: '' }, password: { $ne: '' } })
    expect(res.status).toBe(400)
    expect(res.body.accessToken).toBeUndefined()
  })
})

describe('GET /api/auth/me', () => {
  it('returns the profile for a valid token', async () => {
    const { token } = await registerUser(app, 'rescuer')
    const res = await request(app).get('/api/auth/me').set(bearer(token))
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('rescuer')
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.headers['www-authenticate']).toBe('Bearer realm="kaishare"')
  })

  it('returns 401 for a garbage token', async () => {
    const res = await request(app).get('/api/auth/me').set(bearer('not.a.token'))
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/auth/me', () => {
  it('updates the profile but never the role', async () => {
    const { token } = await registerUser(app, 'rescuer')
    const res = await request(app).patch('/api/auth/me').set(bearer(token)).send({ suburb: 'Mt Eden', role: 'admin' })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ suburb: 'Mt Eden', role: 'rescuer' })
  })
})

describe('refresh token rotation', () => {
  it('issues a new access token and a new refresh cookie', async () => {
    const reg = await request(app).post('/api/auth/register').send(registration)
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(reg))
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeTruthy()
    expect(cookiePair(res)).not.toBe(cookiePair(reg))
  })

  it('detects reuse of an old refresh token and revokes the whole session', async () => {
    const reg = await request(app).post('/api/auth/register').send(registration)
    const firstRefresh = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(reg))

    // An attacker replays the original (already used) token...
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(reg))
    expect(replay.status).toBe(401)

    // ...so the legitimate user's newer token is revoked as well.
    const legit = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(firstRefresh))
    expect(legit.status).toBe(401)
  })

  it('returns 401 without a cookie', async () => {
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401)
  })

  it('cannot refresh after logout', async () => {
    const reg = await request(app).post('/api/auth/register').send(registration)
    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookiePair(reg))
    expect(logout.status).toBe(204)
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(reg))).status).toBe(401)
  })
})

describe('POST /api/auth/google', () => {
  it('creates a Google account with the chosen role', async () => {
    const res = await request(app).post('/api/auth/google').send({ credential: 'google:g-1:tama@example.com:true', role: 'rescuer' })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ email: 'tama@example.com', role: 'rescuer', authProvider: 'google' })
  })

  it('signs the same Google user in again without creating a duplicate', async () => {
    await request(app).post('/api/auth/google').send({ credential: 'google:g-1:tama@example.com:true' })
    const res = await request(app).post('/api/auth/google').send({ credential: 'google:g-1:tama@example.com:true' })
    expect(res.status).toBe(200)
  })

  it('rejects an invalid Google token', async () => {
    const res = await request(app).post('/api/auth/google').send({ credential: 'forged-token-from-somewhere-else' })
    expect(res.status).toBe(401)
  })

  it('reports that Google sign-in is enabled', async () => {
    const res = await request(app).get('/api/auth/providers')
    expect(res.body.google.enabled).toBe(true)
  })
})
