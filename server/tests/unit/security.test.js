import { describe, expect, it, vi } from 'vitest'
import { sanitizeBody, stripMongoOperators } from '../../src/middleware/security.js'
import { escapeRegExp } from '../../src/repositories/ListingRepository.js'

describe('stripMongoOperators', () => {
  it('removes operator keys at any depth and reports them', () => {
    const body = {
      email: { $ne: '' },
      profile: { name: 'Tama', $where: 'sleep(1000)' },
      tags: [{ $gt: 1 }, 'vegan'],
      'a.b': 1,
    }
    const removed = stripMongoOperators(body)
    expect(body).toEqual({ email: {}, profile: { name: 'Tama' }, tags: [{}, 'vegan'] })
    expect(removed.sort()).toEqual(['a.b', 'email.$ne', 'profile.$where', 'tags[0].$gt'])
  })

  it('leaves normal input untouched', () => {
    const body = { title: 'Bread $5 off', quantity: 3, tags: ['vegan'] }
    expect(stripMongoOperators(body)).toEqual([])
    expect(body).toEqual({ title: 'Bread $5 off', quantity: 3, tags: ['vegan'] })
  })
})

describe('sanitizeBody middleware', () => {
  it('logs a warning when it removes something', () => {
    const logger = { warn: vi.fn() }
    const next = vi.fn()
    const req = { id: 'req-1', path: '/api/auth/login', body: { email: { $gt: '' } } }
    sanitizeBody(logger)(req, {}, next)
    expect(req.body).toEqual({ email: {} })
    expect(logger.warn).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })
})

describe('escapeRegExp', () => {
  it('escapes regex characters so user text is matched literally', () => {
    const pattern = new RegExp(`^${escapeRegExp('.*')}$`)
    expect(pattern.test('.*')).toBe(true)
    expect(pattern.test('Ponsonby')).toBe(false)
  })
})
