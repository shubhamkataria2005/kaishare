import { describe, expect, it, vi } from 'vitest'
import { GoogleAuthStrategy, LocalAuthStrategy } from '../../src/auth/strategies.js'
import { PasswordHasher } from '../../src/auth/PasswordHasher.js'
import { UnauthorizedError } from '../../src/utils/errors.js'

const hasher = new PasswordHasher(4)

describe('LocalAuthStrategy', () => {
  async function setup() {
    const user = { id: 'u1', passwordHash: await hasher.hash('Correct123') }
    const users = { findByEmail: vi.fn(async (email) => (email === 'mere@example.com' ? user : null)) }
    return { strategy: new LocalAuthStrategy(users, hasher), user }
  }

  it('returns the user for the right password', async () => {
    const { strategy, user } = await setup()
    await expect(strategy.authenticate({ email: 'mere@example.com', password: 'Correct123' })).resolves.toBe(user)
  })

  it('gives the same error for a wrong password and an unknown email', async () => {
    const { strategy } = await setup()
    const wrongPassword = await strategy.authenticate({ email: 'mere@example.com', password: 'Wrong1234' }).catch((e) => e)
    const unknownEmail = await strategy.authenticate({ email: 'nobody@example.com', password: 'Wrong1234' }).catch((e) => e)
    expect(wrongPassword).toBeInstanceOf(UnauthorizedError)
    expect(unknownEmail.message).toBe(wrongPassword.message)
  })

  it('still runs bcrypt for an unknown email (no timing difference)', async () => {
    const { strategy } = await setup()
    const verify = vi.spyOn(hasher, 'verify')
    await strategy.authenticate({ email: 'nobody@example.com', password: 'x' }).catch(() => {})
    expect(verify).toHaveBeenCalledWith('x', undefined)
  })
})

describe('GoogleAuthStrategy', () => {
  const profile = { sub: 'g-123', email: 'tama@example.com', name: 'Tama', emailVerified: true }

  function setup({ byGoogleId = null, byEmail = null, verified = true } = {}) {
    const users = {
      findByGoogleId: vi.fn(async () => byGoogleId),
      findByEmail: vi.fn(async () => byEmail),
      updateById: vi.fn(async (id, changes) => ({ id, ...changes })),
      create: vi.fn(async (data) => ({ id: 'new', ...data })),
    }
    const verifier = { verify: vi.fn(async () => ({ ...profile, emailVerified: verified })) }
    return { strategy: new GoogleAuthStrategy(users, verifier), users }
  }

  it('signs in a returning Google user', async () => {
    const existing = { id: 'u1' }
    const { strategy, users } = setup({ byGoogleId: existing })
    await expect(strategy.authenticate({ credential: 'token', role: 'donor' })).resolves.toBe(existing)
    expect(users.create).not.toHaveBeenCalled()
  })

  it('links Google to an existing account with the same email', async () => {
    const { strategy, users } = setup({ byEmail: { id: 'u1' } })
    await strategy.authenticate({ credential: 'token', role: 'rescuer' })
    expect(users.updateById).toHaveBeenCalledWith('u1', { googleId: 'g-123' })
  })

  it('creates a new account with the chosen role', async () => {
    const { strategy, users } = setup()
    const user = await strategy.authenticate({ credential: 'token', role: 'donor' })
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'tama@example.com', role: 'donor', authProvider: 'google' }))
    expect(user.id).toBe('new')
  })

  it('rejects a Google account whose email is not verified', async () => {
    const { strategy } = setup({ verified: false })
    await expect(strategy.authenticate({ credential: 'token', role: 'donor' })).rejects.toThrow(/not verified/)
  })
})
