/**
 * The listing form's values and how they convert to the API format.
 * Kept apart from the components so it can be unit tested on its own.
 */
import type { Category, DietaryTag, ListingInput, Unit } from '../types'
import { fromDateTimeLocal, toDateTimeLocal } from '../utils/format'

/** Form state: dates as datetime-local strings, quantity as typed text. */
export interface ListingFormValues {
  title: string
  description: string
  category: Category | ''
  quantity: string
  unit: Unit | ''
  dietaryTags: DietaryTag[]
  pickupStart: string
  pickupEnd: string
  address: string
  suburb: string
}

const HOUR = 60 * 60 * 1000

export function emptyListingForm(now = new Date(), suburb = ''): ListingFormValues {
  return {
    title: '',
    description: '',
    category: '',
    quantity: '',
    unit: '',
    dietaryTags: [],
    pickupStart: toDateTimeLocal(new Date(now.getTime() + 0.5 * HOUR)),
    pickupEnd: toDateTimeLocal(new Date(now.getTime() + 4 * HOUR)),
    address: '',
    suburb,
  }
}

/** Converts the form to the API shape (ISO dates, numeric quantity). */
export function toListingInput(values: ListingFormValues): ListingInput {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category as Category,
    quantity: values.quantity.trim() === '' ? Number.NaN : Number(values.quantity),
    unit: values.unit as Unit,
    dietaryTags: values.dietaryTags,
    pickupStart: values.pickupStart ? fromDateTimeLocal(values.pickupStart) : '',
    pickupEnd: values.pickupEnd ? fromDateTimeLocal(values.pickupEnd) : '',
    address: values.address.trim(),
    suburb: values.suburb.trim(),
  }
}
