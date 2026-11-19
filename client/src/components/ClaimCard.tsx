/**
 * Feature 2 (read/update/delete): one pickup claim with the actions the
 * current user may take.
 * - Rescuer: change pickup time or note, cancel the claim.
 * - Donor:   confirm or decline a pending claim, mark a confirmed one collected.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/ApiError'
import type { ClaimChanges } from '../api/claimsApi'
import { useAuth } from '../auth/useAuth'
import { claimRepository } from '../data/claimRepository'
import type { Claim, FieldErrors } from '../types'
import { UNIT_LABELS } from '../utils/constants'
import { formatDateTime, formatWindow, fromDateTimeLocal, toDateTimeLocal } from '../utils/format'
import { validateNote, validatePickupTime } from '../utils/validation'
import { FormField } from './FormField'
import { ClaimStatusBadge } from './StatusBadge'
import { useToast } from './toast/useToast'

interface Props {
  claim: Claim
  onChanged: () => void
}

export function ClaimCard({ claim, onChanged }: Props) {
  const { user } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const title = claim.listing?.title ?? 'listing'
  const isRescuer = user?.id === claim.rescuerId
  const isDonor = user?.id === claim.donorId || user?.role === 'admin'
  const active = claim.status === 'pending' || claim.status === 'confirmed'

  const run = async (action: () => Promise<{ queued: boolean }>, done: string) => {
    setBusy(true)
    try {
      const result = await action()
      toast[result.queued ? 'info' : 'success'](result.queued ? 'Saved offline. It will be sent when you reconnect.' : done)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (status: NonNullable<ClaimChanges['status']>, done: string) =>
    run(() => claimRepository.update(user!.id, claim.id, { status }, title), done)

  const cancel = () => {
    if (!window.confirm(`Cancel your pickup of "${title}"? The food will be offered to other rescuers.`)) return
    void run(() => claimRepository.remove(user!.id, claim.id, title), 'Claim cancelled.')
  }

  return (
    <article className="claim-card">
      <header className="claim-card-head">
        <h3>
          <Link to={`/listings/${claim.listingId}`}>{title}</Link>
        </h3>
        <ClaimStatusBadge status={claim.status} />
      </header>
      {claim.listing && (
        <p className="small">
          {claim.listing.quantity} {UNIT_LABELS[claim.listing.unit]} · {claim.listing.address}, {claim.listing.suburb}
          <br />
          <span className="muted">Window: {formatWindow(claim.listing.pickupStart, claim.listing.pickupEnd)}</span>
        </p>
      )}
      <dl className="claim-details">
        <div>
          <dt>Pickup time</dt>
          <dd>{formatDateTime(claim.pickupTime)}</dd>
        </div>
        {!isRescuer && (
          <div>
            <dt>Rescuer</dt>
            <dd>
              {claim.rescuerName}
              {claim.rescuerOrganisation ? ` (${claim.rescuerOrganisation})` : ''}
            </dd>
          </div>
        )}
        {claim.note && (
          <div>
            <dt>Note</dt>
            <dd>{claim.note}</dd>
          </div>
        )}
      </dl>

      {editing && claim.listing ? (
        <EditClaimForm
          claim={claim}
          onCancel={() => setEditing(false)}
          onSave={(changes) => run(() => claimRepository.update(user!.id, claim.id, changes, title), 'Pickup details updated.').then(() => setEditing(false))}
        />
      ) : (
        <div className="actions">
          {isRescuer && active && (
            <>
              <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => setEditing(true)}>
                Change time or note
              </button>
              <button type="button" className="button button-danger button-small" disabled={busy} onClick={cancel}>
                Cancel claim
              </button>
            </>
          )}
          {isDonor && claim.status === 'pending' && (
            <>
              <button type="button" className="button button-small" disabled={busy} onClick={() => changeStatus('confirmed', 'Pickup confirmed.')}>
                Confirm pickup
              </button>
              <button type="button" className="button button-danger button-small" disabled={busy} onClick={() => changeStatus('declined', 'Claim declined.')}>
                Decline
              </button>
            </>
          )}
          {isDonor && claim.status === 'confirmed' && (
            <>
              <button type="button" className="button button-small" disabled={busy} onClick={() => changeStatus('collected', 'Marked as collected. Thank you!')}>
                Mark collected
              </button>
              <button type="button" className="button button-danger button-small" disabled={busy} onClick={() => changeStatus('declined', 'Claim declined.')}>
                No-show / decline
              </button>
            </>
          )}
          {isRescuer && claim.status === 'declined' && (
            <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => run(() => claimRepository.remove(user!.id, claim.id, title), 'Removed.')}>
              Remove from list
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function EditClaimForm({ claim, onSave, onCancel }: { claim: Claim; onSave: (changes: ClaimChanges) => Promise<void>; onCancel: () => void }) {
  const [pickupTime, setPickupTime] = useState(toDateTimeLocal(claim.pickupTime))
  const [note, setNote] = useState(claim.note)
  const [errors, setErrors] = useState<FieldErrors>({})

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const iso = pickupTime ? fromDateTimeLocal(pickupTime) : ''
    const found = { ...validatePickupTime(iso, claim.listing!.pickupStart, claim.listing!.pickupEnd), ...validateNote(note) }
    setErrors(found)
    if (Object.keys(found).length) return
    try {
      await onSave({ pickupTime: iso, note: note.trim() })
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors)
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} noValidate aria-label="Change pickup">
      <FormField label="New pickup time" error={errors.pickupTime}>
        <input type="datetime-local" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} />
      </FormField>
      <FormField label="Note for the donor" error={errors.note}>
        <input value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />
      </FormField>
      <div className="actions">
        <button type="submit" className="button button-small">
          Save
        </button>
        <button type="button" className="button button-secondary button-small" onClick={onCancel}>
          Back
        </button>
      </div>
    </form>
  )
}
