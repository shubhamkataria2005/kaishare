import { describe, expect, it } from 'vitest'
import {
  broadcastSchema,
  checkPickupWindow,
  createClaimSchema,
  createListingSchema,
  listingQuerySchema,
  pushSubscriptionSchema,
  registerSchema,
  updateClaimSchema,
  updateListingSchema,
} from '../../src/validation/schemas.js'

const HOUR = 60 * 60 * 1000
const iso = (hoursFromNow) => new Date(Date.now() + hoursFromNow * HOUR).toISOString()

const validRegistration = {
  name: '  Mere Thompson ',
  email: ' Mere@PonsonbyBakehouse.NZ ',
  password: 'Bread2026',
  confirmPassword: 'Bread2026',
  role: 'donor',
}

const validListing = {
  title: 'Sourdough loaves',
  category: 'bakery',
  quantity: '12',
  unit: 'loaves',
  pickupStart: iso(1),
  pickupEnd: iso(4),
  address: '112 Ponsonby Road',
  suburb: 'Ponsonby',
}

describe('registerSchema', () => {
  it('trims the name and lower-cases the email', () => {
    const result = registerSchema.parse(validRegistration)
    expect(result.name).toBe('Mere Thompson')
    expect(result.email).toBe('mere@ponsonbybakehouse.nz')
  })

  it.each([
    ['short', 'Password must be at least 8 characters.'],
    ['12345678', 'Password must contain a letter.'],
    ['onlyletters', 'Password must contain a number.'],
  ])('rejects the weak password "%s"', (password, message) => {
    const result = registerSchema.safeParse({ ...validRegistration, password, confirmPassword: password })
    expect(result.success).toBe(false)
    expect(result.error.issues[0].message).toBe(message)
  })

  it('reports a confirm password mismatch on the confirmPassword field', () => {
    const result = registerSchema.safeParse({ ...validRegistration, confirmPassword: 'Different1' })
    expect(result.success).toBe(false)
    expect(result.error.issues[0].path).toEqual(['confirmPassword'])
  })

  it('does not allow anyone to register as an admin', () => {
    const result = registerSchema.safeParse({ ...validRegistration, role: 'admin' })
    expect(result.success).toBe(false)
  })

  it('drops unknown fields so they cannot be mass-assigned', () => {
    const result = registerSchema.parse({ ...validRegistration, passwordHash: 'x', googleId: 'evil' })
    expect(result).not.toHaveProperty('passwordHash')
    expect(result).not.toHaveProperty('googleId')
  })

  it('rejects an object where a string is expected (NoSQL injection attempt)', () => {
    const result = registerSchema.safeParse({ ...validRegistration, email: { $ne: '' } })
    expect(result.success).toBe(false)
  })
})

describe('createListingSchema', () => {
  it('accepts a valid listing and converts quantity and dates', () => {
    const result = createListingSchema.parse(validListing)
    expect(result.quantity).toBe(12)
    expect(result.pickupStart).toBeInstanceOf(Date)
  })

  it('removes duplicate dietary tags', () => {
    const result = createListingSchema.parse({ ...validListing, dietaryTags: ['vegan', 'vegan', 'halal'] })
    expect(result.dietaryTags).toEqual(['vegan', 'halal'])
  })

  it.each([
    [{ quantity: 0 }, 'quantity'],
    [{ quantity: 2.5 }, 'quantity'],
    [{ category: 'sweets' }, 'category'],
    [{ title: 'ab' }, 'title'],
    [{ pickupEnd: 'tomorrow' }, 'pickupEnd'],
    [{ dietaryTags: ['keto'] }, 'dietaryTags.0'],
  ])('rejects %o on field %s', (change, field) => {
    const result = createListingSchema.safeParse({ ...validListing, ...change })
    expect(result.success).toBe(false)
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain(field)
  })

  it('rejects a pickup window that ends before it starts', () => {
    const result = createListingSchema.safeParse({ ...validListing, pickupStart: iso(5), pickupEnd: iso(4) })
    expect(result.success).toBe(false)
    expect(result.error.issues[0].message).toBe('Pickup end must be after pickup start.')
  })
})

describe('checkPickupWindow', () => {
  const now = new Date('2026-11-20T10:00:00Z')
  const t = (hours) => new Date(now.getTime() + hours * HOUR)

  it('accepts a window in the future', () => {
    expect(checkPickupWindow(t(1), t(3), now)).toEqual({})
  })

  it('rejects a window that has already ended', () => {
    expect(checkPickupWindow(t(-5), t(-1), now).pickupEnd).toBe('Pickup end must be in the future.')
  })

  it('rejects a window longer than 7 days', () => {
    expect(checkPickupWindow(t(0), t(24 * 8), now).pickupEnd).toBe('The pickup window can be at most 7 days.')
  })
})

describe('updateListingSchema', () => {
  it('accepts a partial update', () => {
    expect(updateListingSchema.parse({ quantity: 5 })).toEqual({ quantity: 5 })
  })

  it('rejects an empty update', () => {
    expect(updateListingSchema.safeParse({}).success).toBe(false)
  })

  it('ignores a status sent by the client (status changes only happen through claims)', () => {
    expect(updateListingSchema.parse({ title: 'Bread', status: 'collected' })).toEqual({ title: 'Bread' })
  })
})

describe('listingQuerySchema', () => {
  it('applies paging defaults', () => {
    expect(listingQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
  })

  it('caps the page size at 50', () => {
    expect(listingQuerySchema.safeParse({ limit: '500' }).success).toBe(false)
  })
})

describe('claim schemas', () => {
  it('rejects an invalid listing id', () => {
    const result = createClaimSchema.safeParse({ listingId: 'not-an-id', pickupTime: iso(1) })
    expect(result.error.issues[0].message).toBe('Listing is not valid.')
  })

  it('does not allow a claim to be set back to pending', () => {
    expect(updateClaimSchema.safeParse({ status: 'pending' }).success).toBe(false)
  })

  it('accepts a status change on its own', () => {
    expect(updateClaimSchema.parse({ status: 'confirmed' })).toEqual({ status: 'confirmed' })
  })
})

describe('push schemas', () => {
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } }

  it('accepts a browser subscription', () => {
    expect(pushSubscriptionSchema.safeParse(subscription).success).toBe(true)
  })

  it('rejects a non-https endpoint', () => {
    expect(pushSubscriptionSchema.safeParse({ ...subscription, endpoint: 'http://evil.example/push' }).success).toBe(false)
  })

  it('only allows broadcast links inside the app', () => {
    expect(broadcastSchema.safeParse({ title: 'Hi', body: 'There', url: 'https://evil.example' }).success).toBe(false)
    expect(broadcastSchema.safeParse({ title: 'Hi', body: 'There', url: '/listings' }).success).toBe(true)
  })
})
