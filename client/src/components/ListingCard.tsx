import { Link } from 'react-router-dom'
import type { Listing } from '../types'
import { CATEGORY_ICONS, CATEGORY_LABELS, DIETARY_LABELS, UNIT_LABELS } from '../utils/constants'
import { formatTimeLeft, formatWindow } from '../utils/format'
import { ListingStatusBadge } from './StatusBadge'

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article className="listing-card">
      <div className="listing-card-top">
        <span className="category-chip">
          <span aria-hidden="true">{CATEGORY_ICONS[listing.category]}</span> {CATEGORY_LABELS[listing.category]}
        </span>
        <ListingStatusBadge status={listing.status} expired={listing.isExpired} />
      </div>
      <h3>
        <Link to={`/listings/${listing.id}`} className="stretched-link">
          {listing.title}
        </Link>
      </h3>
      <p className="quantity">
        {listing.quantity} {UNIT_LABELS[listing.unit]}
      </p>
      <p className="muted small">
        {listing.donorOrganisation || listing.donorName} · {listing.suburb}
      </p>
      <p className="small">
        <span aria-hidden="true">🕒</span> {formatWindow(listing.pickupStart, listing.pickupEnd)}
        {listing.status === 'available' && !listing.isExpired && (
          <span className="time-left"> · {formatTimeLeft(listing.pickupEnd)}</span>
        )}
      </p>
      {listing.dietaryTags.length > 0 && (
        <ul className="tags" aria-label="Dietary information">
          {listing.dietaryTags.map((tag) => (
            <li key={tag}>{DIETARY_LABELS[tag]}</li>
          ))}
        </ul>
      )}
    </article>
  )
}
