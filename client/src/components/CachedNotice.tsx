import { formatDateTime } from '../utils/format'

/** Shown above a list when it came from the offline cache. */
export function CachedNotice({ savedAt }: { savedAt: string | null }) {
  return (
    <div className="alert alert-warning" role="status">
      You are offline. Showing the copy saved {savedAt ? formatDateTime(savedAt) : 'earlier'}. Changes you make will be
      sent when you are back online.
    </div>
  )
}
