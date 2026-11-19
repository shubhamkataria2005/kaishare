/**
 * Frontend validation. These rules mirror the server's Zod schemas
 * (server/src/validation/schemas.js) so users see problems immediately,
 * before anything is sent. The server still validates everything again.
 *
 * Each function returns FieldErrors: an empty object means "valid".
 */
import type { FieldErrors, ListingInput } from '../types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_PATTERN = /^(\+?\d[\d\s-]{6,18}\d)?$/
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required.'
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.'
  return undefined
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (password.length > 72) return 'Password must be at most 72 characters.'
  if (!/[A-Za-z]/.test(password)) return 'Password must contain a letter.'
  if (!/\d/.test(password)) return 'Password must contain a number.'
  return undefined
}

/** Removes undefined entries so an empty object means valid. */
function clean(errors: Record<string, string | undefined>): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as FieldErrors
}

export function validateLogin(values: { email: string; password: string }): FieldErrors {
  return clean({
    email: validateEmail(values.email),
    password: values.password ? undefined : 'Password is required.',
  })
}

export interface RegisterValues {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: '' | 'donor' | 'rescuer'
  organisation: string
  suburb: string
  phone: string
}

export function validateRegister(values: RegisterValues): FieldErrors {
  const name = values.name.trim()
  return clean({
    name: !name ? 'Name is required.' : name.length < 2 ? 'Name must be at least 2 characters.' : name.length > 80 ? 'Name must be at most 80 characters.' : undefined,
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    confirmPassword: !values.confirmPassword
      ? 'Please confirm your password.'
      : values.confirmPassword !== values.password
        ? 'Passwords do not match.'
        : undefined,
    role: values.role ? undefined : 'Choose whether you are a donor or a rescuer.',
    organisation: values.organisation.length > 120 ? 'Organisation must be at most 120 characters.' : undefined,
    suburb: values.suburb.length > 60 ? 'Suburb must be at most 60 characters.' : undefined,
    phone: PHONE_PATTERN.test(values.phone.trim()) ? undefined : 'Enter a valid phone number, e.g. 021 123 4567.',
  })
}

export function validatePickupWindow(start: string, end: string, now: Date = new Date()): FieldErrors {
  if (!start) return { pickupStart: 'Pickup start is required.' }
  if (!end) return { pickupEnd: 'Pickup end is required.' }
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  if (Number.isNaN(startTime)) return { pickupStart: 'Pickup start must be a valid date and time.' }
  if (Number.isNaN(endTime)) return { pickupEnd: 'Pickup end must be a valid date and time.' }
  if (endTime <= startTime) return { pickupEnd: 'Pickup end must be after pickup start.' }
  if (endTime - startTime > MAX_WINDOW_MS) return { pickupEnd: 'The pickup window can be at most 7 days.' }
  if (endTime <= now.getTime()) return { pickupEnd: 'Pickup end must be in the future.' }
  return {}
}

export function validateListing(values: ListingInput, now: Date = new Date()): FieldErrors {
  const title = values.title.trim()
  return {
    ...clean({
      title: !title ? 'Title is required.' : title.length < 3 ? 'Title must be at least 3 characters.' : title.length > 80 ? 'Title must be at most 80 characters.' : undefined,
      description: values.description.length > 500 ? 'Description must be at most 500 characters.' : undefined,
      category: values.category ? undefined : 'Choose a category.',
      quantity: !Number.isInteger(values.quantity)
        ? 'Quantity must be a whole number.'
        : values.quantity < 1
          ? 'Quantity must be at least 1.'
          : values.quantity > 10_000
            ? 'Quantity must be at most 10,000.'
            : undefined,
      unit: values.unit ? undefined : 'Choose a unit.',
      address: values.address.trim().length < 5 ? 'Address must be at least 5 characters.' : undefined,
      suburb: values.suburb.trim().length < 2 ? 'Suburb is required.' : undefined,
    }),
    ...validatePickupWindow(values.pickupStart, values.pickupEnd, now),
  }
}

/** The pickup time must fall inside the listing's window (5 minutes' grace for "now"). */
export function validatePickupTime(pickupTime: string, windowStart: string, windowEnd: string, now: Date = new Date()): FieldErrors {
  if (!pickupTime) return { pickupTime: 'Choose a pickup time.' }
  const time = new Date(pickupTime).getTime()
  if (Number.isNaN(time)) return { pickupTime: 'Choose a valid pickup time.' }
  const earliest = Math.max(new Date(windowStart).getTime(), now.getTime() - 5 * 60 * 1000)
  if (time < earliest || time > new Date(windowEnd).getTime()) {
    return { pickupTime: 'Choose a time inside the pickup window.' }
  }
  return {}
}

export function validateNote(note: string): FieldErrors {
  return note.length > 300 ? { note: 'Note must be at most 300 characters.' } : {}
}
