/**
 * Feature 2 (read): rescuers see their pickups; donors see requests for
 * their food.
 */
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { CachedNotice } from '../components/CachedNotice'
import { ClaimCard } from '../components/ClaimCard'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { claimRepository } from '../data/claimRepository'
import { useLoader } from '../hooks/useLoader'

export function ClaimsPage() {
  const { user } = useAuth()
  const { data, loading, error, fromCache, savedAt, reload } = useLoader(() => claimRepository.list(user!.id), [user!.id])
  const isRescuer = user!.role === 'rescuer'

  const active = data?.filter((claim) => claim.status === 'pending' || claim.status === 'confirmed') ?? []
  const past = data?.filter((claim) => claim.status === 'declined' || claim.status === 'collected') ?? []

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>{isRescuer ? 'My pickups' : 'Pickup requests'}</h1>
          <p className="muted">
            {isRescuer ? 'Food you have claimed. Change the time or cancel if your plans change.' : 'Confirm rescuers, then mark food collected once it has gone.'}
          </p>
        </div>
      </div>

      {fromCache && <CachedNotice savedAt={savedAt} />}
      {error && <Alert kind="error">{error}</Alert>}
      {loading && !data && <Spinner />}

      {data && data.length === 0 && (
        <EmptyState icon={isRescuer ? '🚐' : '📭'} title={isRescuer ? 'No pickups yet' : 'No requests yet'}>
          {isRescuer ? (
            <>
              <Link to="/">Browse available food</Link> to make your first claim.
            </>
          ) : (
            'When a rescuer claims your food it shows up here.'
          )}
        </EmptyState>
      )}

      {active.length > 0 && (
        <div className="group">
          <h2 className="h3">Upcoming ({active.length})</h2>
          <div className="claim-list">
            {active.map((claim) => (
              <ClaimCard key={claim.id} claim={claim} onChanged={reload} />
            ))}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div className="group">
          <h2 className="h3">History ({past.length})</h2>
          <div className="claim-list">
            {past.map((claim) => (
              <ClaimCard key={claim.id} claim={claim} onChanged={reload} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
