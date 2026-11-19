import { describe, expect, it } from 'vitest'
import { formatTimeLeft, fromDateTimeLocal, pluralise, toDateTimeLocal } from './format'

describe('formatTimeLeft', () => {
  const now = new Date('2026-11-20T01:00:00Z')
  const plus = (minutes: number) => new Date(now.getTime() + minutes * 60000)

  it.each([
    [-5, 'ended'],
    [25, '25 min left'],
    [180, '3 h left'],
    [60 * 72, '3 days left'],
  ])('%i minutes -> "%s"', (minutes, expected) => {
    expect(formatTimeLeft(plus(minutes), now)).toBe(expected)
  })
})

describe('datetime-local conversion', () => {
  it('round-trips a date through the input format', () => {
    const original = new Date('2026-11-20T03:45:00Z')
    const local = toDateTimeLocal(original)
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(fromDateTimeLocal(local)).toBe(original.toISOString())
  })
})

describe('pluralise', () => {
  it('uses the singular only for one', () => {
    expect(pluralise(1, 'listing')).toBe('1 listing')
    expect(pluralise(0, 'listing')).toBe('0 listings')
    expect(pluralise(3, 'box', 'boxes')).toBe('3 boxes')
  })
})
