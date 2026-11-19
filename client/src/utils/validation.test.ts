import { describe, expect, it } from 'vitest'
import type { ListingInput } from '../types'
import {
  validateEmail,
  validateListing,
  validateLogin,
  validatePassword,
  validatePickupTime,
  validatePickupWindow,
  validateRegister,
  type RegisterValues,
} from './validation'

const HOUR = 60 * 60 * 1000
const now = new Date('2026-11-20T01:00:00Z')
const at = (hours: number) => new Date(now.getTime() + hours * HOUR).toISOString()

describe('validateEmail', () => {
  it.each([
    ['', 'Email is required.'],
    ['mere', 'Enter a valid email address.'],
    ['mere@bakery', 'Enter a valid email address.'],
    ['mere@bakery.nz', undefined],
  ])('"%s" -> %s', (email, expected) => {
    expect(validateEmail(email)).toBe(expected)
  })
})

describe('validatePassword', () => {
  it('requires 8+ characters with a letter and a number', () => {
    expect(validatePassword('abc1')).toBe('Password must be at least 8 characters.')
    expect(validatePassword('abcdefgh')).toBe('Password must contain a number.')
    expect(validatePassword('12345678')).toBe('Password must contain a letter.')
    expect(validatePassword('Kai2026share')).toBeUndefined()
  })

  it('rejects passwords longer than bcrypt can use', () => {
    expect(validatePassword(`a1${'x'.repeat(80)}`)).toBe('Password must be at most 72 characters.')
  })
})

describe('validateLogin', () => {
  it('returns no errors for valid input', () => {
    expect(validateLogin({ email: 'tama@example.com', password: 'x' })).toEqual({})
  })

  it('reports both missing fields', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({ email: 'Email is required.', password: 'Password is required.' })
  })
})

describe('validateRegister', () => {
  const valid: RegisterValues = {
    name: 'Tama Wiremu',
    email: 'tama@example.com',
    password: 'Kai2026share',
    confirmPassword: 'Kai2026share',
    role: 'rescuer',
    organisation: '',
    suburb: '',
    phone: '',
  }

  it('accepts a valid registration', () => {
    expect(validateRegister(valid)).toEqual({})
  })

  it('requires a role and matching passwords', () => {
    const errors = validateRegister({ ...valid, role: '', confirmPassword: 'nope' })
    expect(errors.role).toBe('Choose whether you are a donor or a rescuer.')
    expect(errors.confirmPassword).toBe('Passwords do not match.')
  })

  it('checks the phone format only when one is given', () => {
    expect(validateRegister({ ...valid, phone: '021 123 4567' }).phone).toBeUndefined()
    expect(validateRegister({ ...valid, phone: 'call me' }).phone).toMatch(/valid phone/)
  })
})

describe('validatePickupWindow', () => {
  it('accepts a future window', () => {
    expect(validatePickupWindow(at(1), at(3), now)).toEqual({})
  })

  it('rejects an end before the start', () => {
    expect(validatePickupWindow(at(3), at(1), now).pickupEnd).toBe('Pickup end must be after pickup start.')
  })

  it('rejects a window that has already ended', () => {
    expect(validatePickupWindow(at(-5), at(-1), now).pickupEnd).toBe('Pickup end must be in the future.')
  })

  it('rejects a window longer than 7 days', () => {
    expect(validatePickupWindow(at(0), at(24 * 8), now).pickupEnd).toBe('The pickup window can be at most 7 days.')
  })
})

describe('validateListing', () => {
  const listing: ListingInput = {
    title: 'Sourdough loaves',
    description: '',
    category: 'bakery',
    quantity: 12,
    unit: 'loaves',
    dietaryTags: [],
    pickupStart: at(1),
    pickupEnd: at(4),
    address: '112 Ponsonby Road',
    suburb: 'Ponsonby',
  }

  it('accepts a valid listing', () => {
    expect(validateListing(listing, now)).toEqual({})
  })

  it('rejects a fractional, zero or missing quantity', () => {
    expect(validateListing({ ...listing, quantity: 2.5 }, now).quantity).toBe('Quantity must be a whole number.')
    expect(validateListing({ ...listing, quantity: 0 }, now).quantity).toBe('Quantity must be at least 1.')
    expect(validateListing({ ...listing, quantity: Number.NaN }, now).quantity).toBe('Quantity must be a whole number.')
  })

  it('collects several errors at once', () => {
    const errors = validateListing({ ...listing, title: 'ab', address: '', suburb: '' }, now)
    expect(Object.keys(errors).sort()).toEqual(['address', 'suburb', 'title'])
  })
})

describe('validatePickupTime', () => {
  it('accepts a time inside the window', () => {
    expect(validatePickupTime(at(2), at(1), at(4), now)).toEqual({})
  })

  it('rejects a time after the window', () => {
    expect(validatePickupTime(at(5), at(1), at(4), now).pickupTime).toBe('Choose a time inside the pickup window.')
  })

  it('rejects a time in the past even if the window started earlier', () => {
    expect(validatePickupTime(at(-1), at(-2), at(4), now).pickupTime).toBeDefined()
  })
})
