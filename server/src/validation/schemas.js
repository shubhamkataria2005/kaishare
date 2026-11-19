/**
 * Request validation rules (Zod).
 *
 * Every request body, query string and route parameter is checked against
 * one of these schemas before it reaches a controller. This gives:
 * - clear per-field error messages for the UI (400 responses),
 * - type safety: values are guaranteed strings/numbers/dates, so an object
 *   such as { "$ne": "" } can never reach a MongoDB query (NoSQL injection),
 * - protection from mass assignment: z.object() drops unknown keys, so a
 *   client cannot set fields like "role", "donor" or "status" by sneaking
 *   them into the body.
 *
 * The frontend repeats the same rules (client/src/utils/validation.ts) so
 * users get instant feedback, but the server never trusts the client.
 */
import mongoose from 'mongoose'
import { z } from 'zod'
import { CLAIM_STATUSES } from '../models/Claim.js'
import { CATEGORIES, DIETARY_TAGS, UNITS } from '../models/Listing.js'
import { SELF_SERVICE_ROLES } from '../models/User.js'

const MAX_PICKUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const trimmed = (min, max, label) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`)

const optionalText = (max, label) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters.`).optional()

const email = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.').max(254, 'Email is too long.'))

// bcrypt only uses the first 72 bytes of a password, so cap the length there.
const password = z
  .string({ error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/\d/, 'Password must contain a number.')

// NZ phone numbers: digits, spaces, dashes and an optional leading +.
const phone = z
  .string()
  .trim()
  .regex(/^(\+?\d[\d\s-]{6,18}\d)?$/, 'Enter a valid phone number, e.g. 021 123 4567.')
  .optional()

const isoDate = (label) =>
  z
    .string({ error: `${label} is required.` })
    .pipe(z.iso.datetime({ offset: true, error: `${label} must be a valid date and time.` }))
    .transform((value) => new Date(value))

export const objectId = (label = 'Id') =>
  z.string().refine((value) => mongoose.isValidObjectId(value), `${label} is not valid.`)

/* ---------- Auth ---------- */

export const registerSchema = z
  .object({
    name: trimmed(2, 80, 'Name'),
    email,
    password,
    confirmPassword: z.string({ error: 'Please confirm your password.' }),
    role: z.enum(SELF_SERVICE_ROLES, { error: 'Choose whether you are a donor or a rescuer.' }),
    organisation: optionalText(120, 'Organisation'),
    suburb: optionalText(60, 'Suburb'),
    phone,
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.').max(72),
})

export const googleSignInSchema = z.object({
  credential: z.string({ error: 'Google credential is required.' }).min(20).max(4096),
  role: z.enum(SELF_SERVICE_ROLES).default('rescuer'),
})

export const updateProfileSchema = z
  .object({
    name: trimmed(2, 80, 'Name').optional(),
    organisation: optionalText(120, 'Organisation'),
    suburb: optionalText(60, 'Suburb'),
    phone,
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Nothing to update.',
  })

/* ---------- Listings (feature 1) ---------- */

const listingFields = {
  title: trimmed(3, 80, 'Title'),
  description: optionalText(500, 'Description'),
  category: z.enum(CATEGORIES, { error: 'Choose a category.' }),
  quantity: z.coerce
    .number({ error: 'Quantity must be a number.' })
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .max(10_000, 'Quantity must be at most 10,000.'),
  unit: z.enum(UNITS, { error: 'Choose a unit.' }),
  dietaryTags: z
    .array(z.enum(DIETARY_TAGS, { error: 'Unknown dietary tag.' }))
    .max(DIETARY_TAGS.length)
    .transform((tags) => [...new Set(tags)])
    .optional(),
  pickupStart: isoDate('Pickup start'),
  pickupEnd: isoDate('Pickup end'),
  address: trimmed(5, 160, 'Address'),
  suburb: trimmed(2, 60, 'Suburb'),
}

/**
 * Checks the pickup window. Used for new listings and, by ListingService,
 * for the merged result of an update (old values + changes).
 *
 * @returns {Record<string, string>} field errors (empty when valid)
 */
export function checkPickupWindow(pickupStart, pickupEnd, now = new Date()) {
  const errors = {}
  if (pickupEnd <= pickupStart) {
    errors.pickupEnd = 'Pickup end must be after pickup start.'
  } else if (pickupEnd.getTime() - pickupStart.getTime() > MAX_PICKUP_WINDOW_MS) {
    errors.pickupEnd = 'The pickup window can be at most 7 days.'
  } else if (pickupEnd <= now) {
    errors.pickupEnd = 'Pickup end must be in the future.'
  }
  return errors
}

export const createListingSchema = z.object(listingFields).superRefine((data, ctx) => {
  // Zod still runs this check when a field above has failed, so only
  // compare the dates when both were parsed successfully.
  if (!(data.pickupStart instanceof Date) || !(data.pickupEnd instanceof Date)) return
  for (const [field, message] of Object.entries(checkPickupWindow(data.pickupStart, data.pickupEnd))) {
    ctx.addIssue({ code: 'custom', path: [field], message })
  }
})

export const updateListingSchema = z
  .object(listingFields)
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Nothing to update.',
  })

export const listingQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  suburb: z.string().trim().max(60).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/* ---------- Claims (feature 2) ---------- */

export const createClaimSchema = z.object({
  listingId: objectId('Listing'),
  pickupTime: isoDate('Pickup time'),
  note: optionalText(300, 'Note'),
})

export const updateClaimSchema = z
  .object({
    pickupTime: isoDate('Pickup time').optional(),
    note: optionalText(300, 'Note'),
    status: z.enum(CLAIM_STATUSES.filter((status) => status !== 'pending')).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Nothing to update.',
  })

/* ---------- Push notifications ---------- */

export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/, error: 'Subscription endpoint must be an https URL.' }).max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }),
})

export const pushUnsubscribeSchema = z.object({
  endpoint: z.url().max(1000),
})

export const broadcastSchema = z.object({
  title: trimmed(1, 60, 'Title'),
  body: trimmed(1, 200, 'Message'),
  url: z
    .string()
    .regex(/^\/[\w\-/?=&]*$/, 'URL must be a path inside the app, e.g. /listings.')
    .optional(),
})

export const idParamSchema = z.object({ id: objectId() })
