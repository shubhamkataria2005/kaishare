/** Feature 1: a donor's own listings (all statuses). */
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { CachedNotice } from '../components/CachedNotice'
import { EmptyState } from '../components/EmptyState'
import { ListingCard } from '../components/ListingCard'
import { Spinner } from '../components/Spinner'
import { listingRepository } from '../data/listingRepository'
import { useLoader } from '../hooks/useLoader'

export function MyListingsPage() {
  const { user } = useAuth()
  const { data, loading, error, fromCache, savedAt } = useLoader(() => listingRepository.mine(user!.id), [user!.id])

  const groups = {
    available: data?.filter((listing) => listing.status === 'available') ?? [],
    reserved: data?.filter((listing) => listing.status === 'reserved') ?? [],
    collected: data?.filter((listing) => listing.status === 'collected') ?? [],
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>My listings</h1>
          <p className="muted">Everything you have posted.</p>
        </div>
        {user!.role === 'donor' && (
          <Link to="/listings/new" className="button">
            + Post surplus food
          </Link>
        )}
      </div>

      {fromCache && <CachedNotice savedAt={savedAt} />}
      {error && <Alert kind="error">{error}</Alert>}
      {loading && !data && <Spinner />}

      {data && data.length === 0 && (
        <EmptyState icon="🥖" title="You have not posted any food yet">
          <Link to="/listings/new">Post your first listing</Link> — it only takes a minute.
        </EmptyState>
      )}

      {(['available', 'reserved', 'collected'] as const).map(
        (status) =>
          groups[status].length > 0 && (
            <div key={status} className="group">
              <h2 className="h3">
                {status === 'available' ? 'Waiting for a rescuer' : status === 'reserved' ? 'Claimed – pickup pending' : 'Collected'} (
                {groups[status].length})
              </h2>
              <div className="card-grid">
                {groups[status].map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            </div>
          ),
      )}
    </section>
  )
}
