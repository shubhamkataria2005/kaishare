import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { TokenService } from '../../src/auth/TokenService.js'

const jwtConfig = {
  accessSecret: 'a-test-secret-that-is-long-enough-for-hs256-signing',
  accessExpiresIn: '15m',
  issuer: 'kaishare-api',
  audience: 'kaishare-web',
}
const tokens = new TokenService(jwtConfig)
const user = { id: '665f1c2b9a1e4b0012345678', role: 'donor', name: 'Mere' }

describe('TokenService access tokens', () => {
  it('signs a token whose payload holds the user id and role', () => {
    const payload = tokens.verifyAccessToken(tokens.signAccessToken(user))
    expect(payload.sub).toBe(user.id)
    expect(payload.role).toBe('donor')
    expect(payload.iss).toBe('kaishare-api')
    expect(payload.aud).toBe('kaishare-web')
  })

  it('expires 15 minutes after it is issued', () => {
    const token = tokens.signAccessToken(user)
    const minutes = (tokens.getExpiry(token).getTime() - Date.now()) / 60000
    expect(minutes).toBeGreaterThan(14.9)
    expect(minutes).toBeLessThanOrEqual(15)
  })

  it('rejects a token signed with another secret', () => {
    const forged = jwt.sign({ role: 'admin' }, 'another-secret', { subject: user.id, issuer: 'kaishare-api', audience: 'kaishare-web' })
    expect(() => tokens.verifyAccessToken(forged)).toThrow(jwt.JsonWebTokenError)
  })

  it('rejects an unsigned token (alg "none")', () => {
    const unsigned = jwt.sign({ role: 'admin', sub: user.id, iss: 'kaishare-api', aud: 'kaishare-web' }, null, { algorithm: 'none' })
    expect(() => tokens.verifyAccessToken(unsigned)).toThrow(jwt.JsonWebTokenError)
  })

  it('rejects a token meant for another audience', () => {
    const other = new TokenService({ ...jwtConfig, audience: 'another-app' })
    expect(() => tokens.verifyAccessToken(other.signAccessToken(user))).toThrow(/audience/)
  })

  it('rejects an expired token', () => {
    const expired = jwt.sign({ role: 'donor' }, jwtConfig.accessSecret, {
      subject: user.id,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      expiresIn: -10,
    })
    expect(() => tokens.verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError)
  })

  it('gives every token a unique id', () => {
    const first = jwt.decode(tokens.signAccessToken(user))
    const second = jwt.decode(tokens.signAccessToken(user))
    expect(first.jti).not.toBe(second.jti)
  })
})

describe('TokenService refresh tokens', () => {
  it('creates a long random token and stores only its SHA-256 hash', () => {
    const { token, tokenHash } = tokens.createRefreshToken()
    expect(token).toHaveLength(64) // 48 bytes in base64url
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenHash).not.toContain(token)
    expect(TokenService.hashToken(token)).toBe(tokenHash)
  })

  it('never creates the same token twice', () => {
    const seen = new Set(Array.from({ length: 100 }, () => tokens.createRefreshToken().token))
    expect(seen.size).toBe(100)
  })
})
