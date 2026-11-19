import { describe, expect, it, vi } from 'vitest'
import { TokenService } from '../../src/auth/TokenService.js'
import { authenticate, authorize } from '../../src/middleware/auth.js'
import { ForbiddenError, UnauthorizedError } from '../../src/utils/errors.js'

const tokenService = new TokenService({
  accessSecret: 'a-test-secret-that-is-long-enough-for-hs256-signing',
  accessExpiresIn: '15m',
  issuer: 'kaishare-api',
  audience: 'kaishare-web',
})

function run(middleware, req) {
  const res = { set: vi.fn() }
  const next = vi.fn()
  middleware(req, res, next)
  return { res, next, error: next.mock.calls[0][0] }
}

const requestWith = (authorization) => ({ get: (name) => (name === 'Authorization' ? authorization : undefined) })

describe('authenticate', () => {
  const middleware = authenticate(tokenService)

  it('puts the user from a valid token on req.user', () => {
    const token = tokenService.signAccessToken({ id: 'u1', role: 'rescuer', name: 'Tama' })
    const req = requestWith(`Bearer ${token}`)
    const { error } = run(middleware, req)
    expect(error).toBeUndefined()
    expect(req.user).toEqual({ id: 'u1', role: 'rescuer', name: 'Tama' })
  })

  it('accepts the scheme name in any case', () => {
    const token = tokenService.signAccessToken({ id: 'u1', role: 'rescuer', name: 'Tama' })
    expect(run(middleware, requestWith(`bearer ${token}`)).error).toBeUndefined()
  })

  it('rejects a request without a token', () => {
    const { error, res } = run(middleware, requestWith(undefined))
    expect(error).toBeInstanceOf(UnauthorizedError)
    expect(res.set).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer realm="kaishare"')
  })

  it('rejects a tampered token', () => {
    const token = tokenService.signAccessToken({ id: 'u1', role: 'rescuer', name: 'Tama' })
    const [header, , signature] = token.split('.')
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', role: 'admin' })).toString('base64url')
    const { error } = run(middleware, requestWith(`Bearer ${header}.${payload}.${signature}`))
    expect(error).toBeInstanceOf(UnauthorizedError)
    expect(error.message).toMatch(/invalid/)
  })
})

describe('authorize', () => {
  it('allows a user with one of the roles', () => {
    expect(run(authorize('donor', 'admin'), { user: { role: 'admin' } }).error).toBeUndefined()
  })

  it('responds 403 for a signed-in user with another role', () => {
    const { error } = run(authorize('donor'), { user: { role: 'rescuer' } })
    expect(error).toBeInstanceOf(ForbiddenError)
    expect(error.status).toBe(403)
  })

  it('responds 401 when nobody is signed in', () => {
    expect(run(authorize('donor'), {}).error).toBeInstanceOf(UnauthorizedError)
  })
})
