/**
 * Feature 2: a pickup claim a rescuer makes on a listing.
 *
 * pending   -> confirmed | declined   (donor decides)
 * confirmed -> collected              (donor confirms the pickup happened)
 * A rescuer can change the pickup time/note or cancel (delete) the claim
 * while it is pending or confirmed.
 */
import mongoose from 'mongoose'

export const CLAIM_STATUSES = Object.freeze(['pending', 'confirmed', 'declined', 'collected'])

const claimSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    rescuer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Copied from the listing so a donor's claims can be found with one indexed query.
    donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pickupTime: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: CLAIM_STATUSES, default: 'pending' },
  },
  { timestamps: true },
)

claimSchema.methods.toPublic = function toPublic() {
  const listing = this.listing && this.listing.title ? this.listing : null
  const rescuer = this.rescuer && this.rescuer.name ? this.rescuer : null
  return {
    id: this._id.toString(),
    listingId: listing ? listing._id.toString() : (this.listing?.toString() ?? null),
    listing: listing
      ? {
          title: listing.title,
          quantity: listing.quantity,
          unit: listing.unit,
          address: listing.address,
          suburb: listing.suburb,
          pickupStart: listing.pickupStart,
          pickupEnd: listing.pickupEnd,
          status: listing.status,
        }
      : undefined,
    rescuerId: rescuer ? rescuer._id.toString() : (this.rescuer?.toString() ?? null),
    rescuerName: rescuer ? rescuer.name : undefined,
    rescuerOrganisation: rescuer ? rescuer.organisation : undefined,
    donorId: this.donor.toString(),
    pickupTime: this.pickupTime,
    note: this.note,
    status: this.status,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  }
}

export const Claim = mongoose.model('Claim', claimSchema)
