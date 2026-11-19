import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, stopTestApp } from '../helpers/testApp.js'

let app

beforeAll(async () => {
  ;({ app } = await startTestApp())
})
afterAll(stopTestApp)

describe('app-wide behaviour', () => {
  it('reports health with the replica set details', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.database).toMatchObject({ state: 'connected', replicaSet: 'testset' })
  })

  it('sends security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['strict-transport-security']).toMatch(/max-age/)
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('allows the web app origin and refuses others (CORS)', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(allowed.headers['access-control-allow-credentials']).toBe('true')
    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.example')
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('returns 400 for a body that is not valid JSON', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":')
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Request body is not valid JSON.')
  })

  it('returns 413 for an oversized body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(30_000) })
    expect(res.status).toBe(413)
  })

  it('returns JSON 404 for an unknown route', async () => {
    const res = await request(app).get('/api/nothing-here')
    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/No API route/)
  })
})
