/**
 * Test helpers: an in-memory MongoDB replica set, the real Express app with
 * fake push and Google adapters (injected through the container), and
 * small helpers to create signed-in users.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { config } from '../../src/config/env.js'
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js'
import { createContainer } from '../../src/container.js'
import { UnauthorizedError } from '../../src/utils/errors.js'

/** Records every push message instead of sending it. */
export class FakePushSender {
  isConfigured = true
  sent = []
  /** endpoints that should fail with this status code */
  failures = new Map()

  async send(subscription, payload) {
    const statusCode = this.failures.get(subscription.endpoint)
    if (statusCode) throw Object.assign(new Error('Push failed'), { statusCode })
    this.sent.push({ endpoint: subscription.endpoint, payload })
    return { statusCode: 201 }
  }
}

/** Accepts ID tokens of the form "google:<sub>:<email>:<verified>". */
export const fakeGoogleVerifier = {
  isConfigured: true,
  async verify(idToken) {
    const [prefix, sub, email, verified] = idToken.split(':')
    // Same behaviour as GoogleTokenVerifier for a token Google did not sign.
    if (prefix !== 'google') throw new UnauthorizedError('Google sign-in failed. Please try again.')
    return { sub, email, name: email.split('@')[0], emailVerified: verified === 'true' }
  },
}

let replSet

export async function startTestApp() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await connectDatabase(replSet.getUri('kaishare_test'))
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()))

  const pushSender = new FakePushSender()
  const container = createContainer(config, { pushSender, googleVerifier: fakeGoogleVerifier })
  const app = createApp(container)
  return { app, container, pushSender }
}

export async function stopTestApp() {
  await disconnectDatabase()
  await replSet?.stop()
}

export async function clearDatabase() {
  await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})))
}

let userCounter = 0

/**
 * Registers a user through the API and returns their access token.
 *
 * @param {import('express').Express} app
 * @param {'donor' | 'rescuer'} role
 */
export async function registerUser(app, role = 'rescuer', overrides = {}) {
  userCounter += 1
  const body = {
    name: `Test ${role} ${userCounter}`,
    email: `${role}${userCounter}@example.com`,
    password: 'Password123',
    confirmPassword: 'Password123',
    role,
    organisation: `${role} org`,
    suburb: 'Ponsonby',
    ...overrides,
  }
  const res = await request(app).post('/api/auth/register').send(body)
  if (res.status !== 201) throw new Error(`Register failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { token: res.body.accessToken, user: res.body.user, password: body.password, cookies: res.headers['set-cookie'] }
}

/** Makes an existing user an admin (admins cannot self-register). */
export async function makeAdmin(app, userId) {
  await mongoose.model('User').updateOne({ _id: userId }, { role: 'admin' })
  const user = await mongoose.model('User').findById(userId)
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' })
  return res.body.accessToken
}

const HOUR = 60 * 60 * 1000

/** A valid listing body with a pickup window starting now. */
export function listingBody(overrides = {}) {
  return {
    title: 'Sourdough loaves',
    description: 'Fresh this morning',
    category: 'bakery',
    quantity: 12,
    unit: 'loaves',
    dietaryTags: ['vegan'],
    pickupStart: new Date(Date.now() - 0.5 * HOUR).toISOString(),
    pickupEnd: new Date(Date.now() + 4 * HOUR).toISOString(),
    address: '112 Ponsonby Road',
    suburb: 'Ponsonby',
    ...overrides,
  }
}

export const inHours = (hours) => new Date(Date.now() + hours * HOUR).toISOString()

export const bearer = (token) => ({ Authorization: `Bearer ${token}` })
