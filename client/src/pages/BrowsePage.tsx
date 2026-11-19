/** Feature 1 (read): open surplus food listings with search and filters. */
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ListingQuery } from '../api/listingsApi'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { CachedNotice } from '../components/CachedNotice'
import { EmptyState } from '../components/EmptyState'
import { ListingCard } from '../components/ListingCard'
import { Spinner } from '../components/Spinner'
import { listingRepository } from '../data/listingRepository'
import { useLoader } from '../hooks/useLoader'
import type { Category } from '../types'
import { CATEGORIES, CATEGORY_LABELS } from '../utils/constants'
import { pluralise } from '../utils/format'

export function BrowsePage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const query: ListingQuery = {
    q: params.get('q') ?? '',
    category: (params.get('category') ?? '') as Category | '',
    suburb: params.get('suburb') ?? '',
    page: Number(params.get('page') ?? 1) || 1,
  }
  const { data, loading, error, fromCache, savedAt } = useLoader(
    () => listingRepository.browse(user!.id, query),
    [user!.id, params.toString()],
  )

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Surplus food near you</h1>
          <p className="muted">
            {user!.role === 'rescuer'
              ? 'Claim food before the pickup window closes.'
              : 'Everything currently available across the network.'}
          </p>
        </div>
        {user!.role === 'donor' && (
          <Link to="/listings/new" className="button">
            + Post surplus food
          </Link>
        )}
      </div>

      {/* Re-created when the URL changes, so the inputs always match the filters. */}
      <SearchForm key={params.toString()} query={query} onChange={update} />

      {fromCache && <CachedNotice savedAt={savedAt} />}
      {error && <Alert kind="error">{error}</Alert>}
      {loading && !data && <Spinner label="Finding food…" />}

      {data && (
        <>
          <p className="muted small" aria-live="polite">
            {pluralise(data.total, 'listing')} available
          </p>
          {data.items.length === 0 ? (
            <EmptyState icon="🧺" title="No food listed right now">
              Try another search, or turn on notifications on your profile to hear about new food straight away.
            </EmptyState>
          ) : (
            <div className="card-grid">
              {data.items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
          {data.totalPages > 1 && (
            <nav className="pagination" aria-label="Pages">
              <button
                type="button"
                className="button button-secondary"
                disabled={data.page <= 1}
                onClick={() => update({ page: String(data.page - 1) })}
              >
                Previous
              </button>
              <span>
                Page {data.page} of {data.totalPages}
              </span>
              <button
                type="button"
                className="button button-secondary"
                disabled={data.page >= data.totalPages}
                onClick={() => update({ page: String(data.page + 1) })}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}

interface SearchFormProps {
  query: ListingQuery
  onChange: (changes: Record<string, string>) => void
}

function SearchForm({ query, onChange }: SearchFormProps) {
  const [search, setSearch] = useState(query.q ?? '')
  const [suburb, setSuburb] = useState(query.suburb ?? '')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onChange({ q: search.trim(), suburb: suburb.trim() })
  }

  return (
    <form className="filters" onSubmit={handleSubmit} role="search">
      <label className="sr-only" htmlFor="search">
        Search
      </label>
      <input
        id="search"
        type="search"
        placeholder="Search e.g. bread, curry, apples"
        value={search}
        maxLength={100}
        onChange={(event) => setSearch(event.target.value)}
      />
      <label className="sr-only" htmlFor="suburb">
        Suburb
      </label>
      <input id="suburb" placeholder="Suburb" value={suburb} maxLength={60} onChange={(event) => setSuburb(event.target.value)} />
      <label className="sr-only" htmlFor="category">
        Category
      </label>
      <select id="category" value={query.category} onChange={(event) => onChange({ category: event.target.value })}>
        <option value="">All categories</option>
        {CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>
      <button type="submit" className="button">
        Search
      </button>
    </form>
  )
}
