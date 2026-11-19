import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/config/env.js'

const base = { MONGODB_URI: 'mongodb://localhost/kaishare', JWT_ACCESS_SECRET: 'x'.repeat(32) }

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(base)
    expect(config.port).toBe(4000)
    expect(config.jwt.accessExpiresIn).toBe('15m')
    expect(config.refreshToken.secure).toBe(false)
  })

  it('refuses to start with a short JWT secret', () => {
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/)
  })

  it('refuses to start without a database URI', () => {
    expect(() => loadConfig({ JWT_ACCESS_SECRET: 'x'.repeat(32) })).toThrow(/MONGODB_URI/)
  })

  it('always uses secure cookies in production', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).refreshToken.secure).toBe(true)
  })

  it('splits the CORS origin list', () => {
    const config = loadConfig({ ...base, CORS_ORIGINS: 'https://kaishare.nz, http://localhost:5173' })
    expect(config.corsOrigins).toEqual(['https://kaishare.nz', 'http://localhost:5173'])
  })
})
