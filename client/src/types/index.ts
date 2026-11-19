/** Shapes of the data the KaiShare API returns. */

export type Role = 'donor' | 'rescuer' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  authProvider: 'local' | 'google'
  organisation: string
  suburb: string
  phone: string
  createdAt: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  accessTokenExpiresAt: string
}

export type Category = 'bakery' | 'produce' | 'dairy' | 'prepared-meals' | 'pantry' | 'meat-seafood' | 'other'
export type Unit = 'items' | 'kg' | 'portions' | 'boxes' | 'loaves' | 'trays'
export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'halal' | 'nut-free'
export type ListingStatus = 'available' | 'reserved' | 'collected'

export interface Listing {
  id: string
  donorId: string
  donorName?: string
  donorOrganisation?: string
  title: string
  description: string
  category: Category
  quantity: number
  unit: Unit
  dietaryTags: DietaryTag[]
  pickupStart: string
  pickupEnd: string
  address: string
  suburb: string
  status: ListingStatus
  isExpired: boolean
  createdAt: string
  updatedAt: string
  /** Only for the owner/admin: the claim currently holding the listing. */
  activeClaim?: Claim | null
}

/** What the listing form sends to the API. */
export interface ListingInput {
  title: string
  description: string
  category: Category
  quantity: number
  unit: Unit
  dietaryTags: DietaryTag[]
  pickupStart: string
  pickupEnd: string
  address: string
  suburb: string
}

export interface ListingPage {
  items: Listing[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type ClaimStatus = 'pending' | 'confirmed' | 'declined' | 'collected'

export interface Claim {
  id: string
  listingId: string
  listing?: Pick<Listing, 'title' | 'quantity' | 'unit' | 'address' | 'suburb' | 'pickupStart' | 'pickupEnd' | 'status'>
  rescuerId: string
  rescuerName?: string
  rescuerOrganisation?: string
  donorId: string
  pickupTime: string
  note: string
  status: ClaimStatus
  createdAt: string
  updatedAt: string
}

export interface ClaimInput {
  listingId: string
  pickupTime: string
  note: string
}

/** Field name -> error message. */
export type FieldErrors = Record<string, string>
