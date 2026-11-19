import type { Category, ClaimStatus, DietaryTag, ListingStatus, Unit } from '../types'

export const CATEGORY_LABELS: Record<Category, string> = {
  bakery: 'Bakery',
  produce: 'Fruit & vegetables',
  dairy: 'Dairy',
  'prepared-meals': 'Prepared meals',
  pantry: 'Pantry',
  'meat-seafood': 'Meat & seafood',
  other: 'Other',
}

export const CATEGORY_ICONS: Record<Category, string> = {
  bakery: '🥖',
  produce: '🥕',
  dairy: '🥛',
  'prepared-meals': '🍲',
  pantry: '🥫',
  'meat-seafood': '🐟',
  other: '🧺',
}

export const UNIT_LABELS: Record<Unit, string> = {
  items: 'items',
  kg: 'kg',
  portions: 'portions',
  boxes: 'boxes',
  loaves: 'loaves',
  trays: 'trays',
}

export const DIETARY_LABELS: Record<DietaryTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'gluten-free': 'Gluten-free',
  'dairy-free': 'Dairy-free',
  halal: 'Halal',
  'nut-free': 'Nut-free',
}

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  collected: 'Collected',
}

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  pending: 'Waiting for donor',
  confirmed: 'Confirmed',
  declined: 'Declined',
  collected: 'Collected',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]
export const UNITS = Object.keys(UNIT_LABELS) as Unit[]
export const DIETARY_TAGS = Object.keys(DIETARY_LABELS) as DietaryTag[]
