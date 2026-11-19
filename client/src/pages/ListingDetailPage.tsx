/**
 * One listing. Rescuers can claim it (feature 2: create). The owner sees
 * edit/delete (feature 1: update, delete) and the claim holding it.
 */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/ApiError'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { CachedNotice } from '../components/CachedNotice'
import { ClaimCard } from '../components/ClaimCard'
import { FormField } from '../components/FormField'
import { Spinner } from '../components/Spinner'
import { ListingStatusBadge } from '../components/StatusBadge'
import { useToast } from '../components/toast/useToast'
import { claimRepository } from '../data/claimRepository'
import { listingRepository } from '../data/listingRepository'
import { useLoader } from '../hooks/useLoader'
import type { FieldErrors, Listing } from '../types'
import { CATEGORY_ICONS, CATEGORY_LABELS, DIETARY_LABELS, UNIT_LABELS } from '../utils/constants'
import { formatDateTime, formatTimeLeft, formatWindow, fromDateTimeLocal, toDateTimeLocal } from '../utils/format'
import { validateNote, validatePickupTime } from '../utils/validation'

export function ListingDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: listing, loading, error, fromCache, savedAt, reload } = useLoader(() => listingRepository.get(user!.id, id), [id, user!.id])

  if (loading && !listing) return <Spinner />
  if (error && !listing) return <Alert kind="error">{error}</Alert>
  if (!listing) return null

  const isOwner = listing.donorId === user!.id
  const canManage = isOwner || user!.role === 'admin'
  const canClaim = user!.role === 'rescuer' && listing.status === 'available' && !listing.isExpired

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return
    try {
      const result = await listingRepository.remove(user!.id, listing.id, listing.title)
      toast[result.queued ? 'info' : 'success'](result.queued ? 'Saved offline. It will be deleted when you reconnect.' : 'Listing deleted.')
      navigate('/my-listings')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the listing.')
    }
  }

  return (
    <section className="detail">
      <Link to="/" className="back-link">
        ← Back to listings
      </Link>
      {fromCache && <CachedNotice savedAt={savedAt} />}

      <div className="detail-grid">
        <article className="card">
          <div className="listing-card-top">
            <span className="category-chip">
              <span aria-hidden="true">{CATEGORY_ICONS[listing.category]}</span> {CATEGORY_LABELS[listing.category]}
            </span>
            <ListingStatusBadge status={listing.status} expired={listing.isExpired} />
          </div>
          <h1>{listing.title}</h1>
          <p className="quantity big">
            {listing.quantity} {UNIT_LABELS[listing.unit]}
          </p>
          {listing.description && <p>{listing.description}</p>}

          <dl className="facts">
            <div>
              <dt>Donor</dt>
              <dd>{listing.donorOrganisation || listing.donorName}</dd>
            </div>
            <div>
              <dt>Pickup window</dt>
              <dd>
                {formatWindow(listing.pickupStart, listing.pickupEnd)}
                {listing.status === 'available' && !listing.isExpired && <span className="time-left"> ({formatTimeLeft(listing.pickupEnd)})</span>}
              </dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>
                {listing.address}, {listing.suburb}
              </dd>
            </div>
            <div>
              <dt>Posted</dt>
              <dd>{formatDateTime(listing.createdAt)}</dd>
            </div>
          </dl>

          {listing.dietaryTags.length > 0 && (
            <ul className="tags" aria-label="Dietary information">
              {listing.dietaryTags.map((tag) => (
                <li key={tag}>{DIETARY_LABELS[tag]}</li>
              ))}
            </ul>
          )}

          {canManage && (
            <div className="actions">
              {listing.status === 'available' && (
                <Link to={`/listings/${listing.id}/edit`} className="button button-secondary">
                  Edit
                </Link>
              )}
              {listing.status !== 'reserved' && (
                <button type="button" className="button button-danger" onClick={handleDelete}>
                  Delete
                </button>
              )}
            </div>
          )}
        </article>

        <aside>
          {canClaim && <ClaimForm listing={listing} onClaimed={reload} />}
          {user!.role === 'rescuer' && !canClaim && (
            <div className="card">
              <p className="muted">
                {listing.isExpired ? 'The pickup window has closed.' : 'This food has already been claimed.'}{' '}
                <Link to="/">Find other food</Link>.
              </p>
            </div>
          )}
          {canManage && listing.activeClaim && (
            <div>
              <h2 className="h3">Current claim</h2>
              <ClaimCard claim={{ ...listing.activeClaim, listing }} onChanged={reload} />
            </div>
          )}
          {canManage && !listing.activeClaim && listing.status === 'available' && (
            <div className="card">
              <p className="muted">No one has claimed this yet. Rescuers were notified when you posted it.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

function ClaimForm({ listing, onClaimed }: { listing: Listing; onClaimed: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  // Suggest 30 minutes from now, or the start of the window if that is
  // later. Rounded UP to a whole minute: the datetime-local input drops
  // seconds, and rounding down could put the time before the window opens.
  const [pickupTime, setPickupTime] = useState(() => {
    const earliest = Math.max(Date.now() + 30 * 60 * 1000, new Date(listing.pickupStart).getTime())
    return toDateTimeLocal(new Date(Math.ceil(earliest / 60_000) * 60_000))
  })
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const iso = pickupTime ? fromDateTimeLocal(pickupTime) : ''
    const found = { ...validatePickupTime(iso, listing.pickupStart, listing.pickupEnd), ...validateNote(note) }
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      const result = await claimRepository.create(user!.id, { listingId: listing.id, pickupTime: iso, note: note.trim() }, listing.title)
      if (result.queued) {
        toast.info('You are offline. Your claim will be sent when you reconnect.')
      } else {
        toast.success('Claimed! The donor has been notified.')
        navigate('/claims')
      }
      onClaimed()
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors)
        setFormError(error.message)
        if (error.status === 409) onClaimed()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate aria-label="Claim this food">
      <h2 className="h3">Claim this food</h2>
      {formError && <Alert kind="error">{formError}</Alert>}
      <FormField label="When will you pick it up?" error={errors.pickupTime} hint={`Between ${formatWindow(listing.pickupStart, listing.pickupEnd)}`}>
        <input type="datetime-local" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} />
      </FormField>
      <FormField label="Note for the donor (optional)" error={errors.note}>
        <textarea rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Blue van, bringing crates" />
      </FormField>
      <button type="submit" className="button button-block" disabled={submitting}>
        {submitting ? 'Claiming…' : 'Claim for pickup'}
      </button>
    </form>
  )
}
