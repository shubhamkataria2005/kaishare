/**
 * Keeps the count of queued offline changes up to date and sends them when
 * the app is online and signed in. Returns the number still waiting.
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { flushOutbox, listQueued, onOutboxChange } from '../offline/outbox'
import { useToast } from '../components/toast/useToast'
import { pluralise } from '../utils/format'
import { useOnlineStatus } from './useOnlineStatus'

export function useOutboxSync(): number {
  const { status, user } = useAuth()
  const online = useOnlineStatus()
  const toast = useToast()
  const [count, setCount] = useState(0)

  const refreshCount = useCallback(() => {
    if (!user) return
    listQueued(user.id).then((items) => setCount(items.length))
  }, [user])

  useEffect(() => {
    refreshCount()
    return onOutboxChange(refreshCount)
  }, [refreshCount])

  useEffect(() => {
    if (!online || status !== 'authenticated' || !user) return
    let cancelled = false
    flushOutbox(user.id).then((result) => {
      if (cancelled) return
      if (result.synced.length) toast.success(`Back online: ${pluralise(result.synced.length, 'saved change')} sent.`)
      for (const failure of result.failed) toast.error(`"${failure.label}" could not be saved: ${failure.message}`)
      if (result.synced.length || result.failed.length) window.dispatchEvent(new Event('kaishare:data-changed'))
    })
    return () => {
      cancelled = true
    }
  }, [online, status, user, toast])

  return user ? count : 0
}
