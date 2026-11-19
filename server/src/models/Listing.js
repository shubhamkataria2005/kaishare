/**
 * Feature 1: a surplus food listing posted by a donor.
 *
 * Status life cycle (see ClaimService for the transitions):
 *   available -> reserved   a rescuer claims it
 *   reserved  -> available  the claim is cancelled or declined
 *   reserved  -> collected  the donor confirms the food was picked up
 */
import mongoose from 'mongoose'

export const CATEGORIES = Object.freeze(['bakery', 'produce', 'dairy', 'prepared-meals', 'pantry', 'meat-seafood', 'other'])
export const UNITS = Object.freeze(['items', 'kg', 'portions', 'boxes', 'loaves', 'trays'])
export const DIETARY_TAGS = Object.freeze(['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'halal', 'nut-free'])
export const LISTING_STATUSES = Object.freeze(['available', 'reserved', 'collected'])

const listingSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    category: { type: String, enum: CATEGORIES, required: true },
    quantity: { type: Number, required: true, min: 1, max: 10_000 },
    unit: { type: String, enum: UNITS, required: true },
    dietaryTags: { type: [{ type: String, enum: DIETARY_TAGS }], default: [] },
    pickupStart: { type: Date, required: true },
    pickupEnd: { type: Date, required: true },
    address: { type: String, required: true, trim: true, maxlength: 160 },
    suburb: { type: String, required: true, trim: true, maxlength: 60 },
    status: { type: String, enum: LISTING_STATUSES, default: 'available' },
  },
  { timestamps: true },
)

// Indexes for the most common queries: the browse page (open listings,
// soonest pickup first, optionally by suburb/category) and text search.
listingSchema.index({ status: 1, pickupEnd: 1 })
listingSchema.index({ suburb: 1, category: 1 })
listingSchema.index({ title: 'text', description: 'text' })

listingSchema.methods.toPublic = function toPublic() {
  const donor = this.donor && this.donor.name ? this.donor : null
  return {
    id: this._id.toString(),
    donorId: donor ? donor._id.toString() : this.donor.toString(),
    donorName: donor ? donor.name : undefined,
    donorOrganisation: donor ? donor.organisation : undefined,
    title: this.title,
    description: this.description,
    category: this.category,
    quantity: this.quantity,
    unit: this.unit,
    dietaryTags: this.dietaryTags,
    pickupStart: this.pickupStart,
    pickupEnd: this.pickupEnd,
    address: this.address,
    suburb: this.suburb,
    status: this.status,
    // Derived, not stored: an available listing whose window has passed.
    isExpired: this.status === 'available' && this.pickupEnd.getTime() < Date.now(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  }
}

export const Listing = mongoose.model('Listing', listingSchema)
