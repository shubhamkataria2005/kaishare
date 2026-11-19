/** Feature 1 (create + update): the listing form, used for new and edit. */
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/ApiError'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { FormField } from '../components/FormField'
import { Spinner } from '../components/Spinner'
import { useToast } from '../components/toast/useToast'
import { listingRepository } from '../data/listingRepository'
import type { DietaryTag, FieldErrors, ListingInput } from '../types'
import { CATEGORIES, CATEGORY_LABELS, DIETARY_LABELS, DIETARY_TAGS, UNITS, UNIT_LABELS } from '../utils/constants'
import { toDateTimeLocal } from '../utils/format'
import { validateListing } from '../utils/validation'
import { emptyListingForm, toListingInput, type ListingFormValues } from './listingFormModel'

interface FormProps {
  initial: ListingFormValues
  submitLabel: string
  onSubmit: (input: ListingInput) => Promise<void>
}

export function ListingForm({ initial, submitLabel, onSubmit }: FormProps) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (field: keyof ListingFormValues) => (event: { target: { value: string } }) =>
    setValues((previous) => ({ ...previous, [field]: event.target.value }))

  const toggleTag = (tag: DietaryTag) =>
    setValues((previous) => ({
      ...previous,
      dietaryTags: previous.dietaryTags.includes(tag)
        ? previous.dietaryTags.filter((t) => t !== tag)
        : [...previous.dietaryTags, tag],
    }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const input = toListingInput(values)
    const found = validateListing(input)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) {
      setFormError('Please correct the highlighted fields.')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(input)
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors)
        setFormError(error.message)
      } else {
        setFormError('Could not save the listing. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Listing">
      {formError && <Alert kind="error">{formError}</Alert>}

      <FormField label="What food is it?" error={errors.title}>
        <input value={values.title} maxLength={80} onChange={set('title')} placeholder="e.g. Sourdough loaves" />
      </FormField>

      <FormField label="Description (optional)" error={errors.description} hint={`${values.description.length}/500`}>
        <textarea rows={3} maxLength={500} value={values.description} onChange={set('description')} placeholder="Condition, storage, allergens…" />
      </FormField>

      <div className="grid-3">
        <FormField label="Category" error={errors.category}>
          <select value={values.category} onChange={set('category')}>
            <option value="">Choose…</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Quantity" error={errors.quantity}>
          <input type="number" inputMode="numeric" min={1} max={10000} step={1} value={values.quantity} onChange={set('quantity')} />
        </FormField>
        <FormField label="Unit" error={errors.unit}>
          <select value={values.unit} onChange={set('unit')}>
            <option value="">Choose…</option>
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_LABELS[unit]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <fieldset className="tag-picker">
        <legend>Dietary information</legend>
        {DIETARY_TAGS.map((tag) => (
          <label key={tag} className={values.dietaryTags.includes(tag) ? 'tag-option selected' : 'tag-option'}>
            <input type="checkbox" checked={values.dietaryTags.includes(tag)} onChange={() => toggleTag(tag)} />
            {DIETARY_LABELS[tag]}
          </label>
        ))}
      </fieldset>

      <div className="grid-2">
        <FormField label="Pickup from" error={errors.pickupStart}>
          <input type="datetime-local" value={values.pickupStart} onChange={set('pickupStart')} />
        </FormField>
        <FormField label="Pickup until" error={errors.pickupEnd} hint="At most 7 days after the start.">
          <input type="datetime-local" value={values.pickupEnd} onChange={set('pickupEnd')} />
        </FormField>
        <FormField label="Pickup address" error={errors.address}>
          <input autoComplete="street-address" value={values.address} maxLength={160} onChange={set('address')} />
        </FormField>
        <FormField label="Suburb" error={errors.suburb}>
          <input value={values.suburb} maxLength={60} onChange={set('suburb')} />
        </FormField>
      </div>

      <button type="submit" className="button" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}

export function NewListingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  // The default pickup window starts from "now" when the page opens.
  const [initial] = useState(() => emptyListingForm(new Date(), user!.suburb))

  const handleCreate = async (input: ListingInput) => {
    const result = await listingRepository.create(user!.id, input)
    if (result.queued) {
      toast.info('You are offline. The listing will be posted when you reconnect.')
      navigate('/my-listings')
    } else {
      toast.success('Listing posted. Rescuers have been notified.')
      navigate(`/listings/${result.data.listing.id}`)
    }
  }

  return (
    <section className="card narrow">
      <h1>Post surplus food</h1>
      <p className="muted">Rescuers nearby get a notification as soon as you post.</p>
      <ListingForm initial={initial} submitLabel="Post listing" onSubmit={handleCreate} />
    </section>
  )
}

export function EditListingPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [initial, setInitial] = useState<ListingFormValues | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listingRepository
      .get(user!.id, id)
      .then(({ data }) => {
        setTitle(data.title)
        setInitial({
          title: data.title,
          description: data.description,
          category: data.category,
          quantity: String(data.quantity),
          unit: data.unit,
          dietaryTags: data.dietaryTags,
          pickupStart: toDateTimeLocal(data.pickupStart),
          pickupEnd: toDateTimeLocal(data.pickupEnd),
          address: data.address,
          suburb: data.suburb,
        })
      })
      .catch((err: Error) => setError(err.message))
  }, [id, user])

  const handleUpdate = async (input: ListingInput) => {
    const result = await listingRepository.update(user!.id, id, input, title)
    toast[result.queued ? 'info' : 'success'](result.queued ? 'Saved offline. The change will be sent when you reconnect.' : 'Listing updated.')
    navigate(`/listings/${id}`)
  }

  if (error) return <Alert kind="error">{error}</Alert>
  if (!initial) return <Spinner />

  return (
    <section className="card narrow">
      <h1>Edit listing</h1>
      <ListingForm initial={initial} submitLabel="Save changes" onSubmit={handleUpdate} />
    </section>
  )
}
