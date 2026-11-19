/**
 * Loads data for a page through the offline cache and tracks
 * loading/error/stale state. Reloads when the deps change, when queued
 * changes have been synced, and when the browser comes back online.
 */
import { useCallback, useEffect, useState, type DependencyList } from 'react'
import type { Loaded } from '../offline/offlineCache'

export interface LoaderState<T> {
  data: T | null
  loading: boolean
  error: string | null
  fromCache: boolean
  savedAt: string | null
  reload: () => void
}

export function useLoader<T>(load: () => Promise<Loaded<T>>, deps: DependencyList): LoaderState<T> {
  const [state, setState] = useState<Omit<LoaderState<T>, 'reload'>>({
    data: null,
    loading: true,
    error: null,
    fromCache: false,
    savedAt: null,
  })
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    setState((previous) => ({ ...previous, loading: true, error: null }))
    load()
      .then((result) => {
        if (!cancelled) setState({ data: result.data, loading: false, error: null, fromCache: result.fromCache, savedAt: result.savedAt })
      })
      .catch((error: Error) => {
        if (!cancelled) setState((previous) => ({ ...previous, loading: false, error: error.message }))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  useEffect(() => {
    window.addEventListener('kaishare:data-changed', reload)
    window.addEventListener('online', reload)
    return () => {
      window.removeEventListener('kaishare:data-changed', reload)
      window.removeEventListener('online', reload)
    }
  }, [reload])

  return { ...state, reload }
}
