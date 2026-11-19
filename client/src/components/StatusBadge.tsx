import type { ClaimStatus, ListingStatus } from '../types'
import { CLAIM_STATUS_LABELS, LISTING_STATUS_LABELS } from '../utils/constants'

export function ListingStatusBadge({ status, expired }: { status: ListingStatus; expired?: boolean }) {
  if (expired) return <span className="badge badge-muted">Expired</span>
  return <span className={`badge badge-${status}`}>{LISTING_STATUS_LABELS[status]}</span>
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <span className={`badge badge-claim-${status}`}>{CLAIM_STATUS_LABELS[status]}</span>
}
