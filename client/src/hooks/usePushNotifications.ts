/** State and actions for the "Notifications" panel on the Profile page. */
import { useCallback, useEffect, useState } from 'react'
import { enablePush, disablePushForThisDevice, getCurrentSubscription, isPushSupported } from '../pwa/pushSubscription'

export interface PushState {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  busy: boolean
  error: string | null
}

export function usePushNotifications() {
  const supported = isPushSupported()
  const [state, setState] = useState<PushState>({
    supported,
    permission: supported ? Notification.permission : 'unsupported',
    subscribed: false,
    busy: supported,
    error: null,
  })

  useEffect(() => {
    if (!supported) return
    getCurrentSubscription()
      .then((subscription) => setState((s) => ({ ...s, subscribed: Boolean(subscription), busy: false })))
      .catch(() => setState((s) => ({ ...s, busy: false })))
  }, [supported])

  const enable = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: null }))
    try {
      await enablePush()
      setState((s) => ({ ...s, subscribed: true, busy: false, permission: Notification.permission }))
    } catch (error) {
      setState((s) => ({ ...s, busy: false, permission: Notification.permission, error: error instanceof Error ? error.message : 'Could not turn on notifications.' }))
    }
  }, [])

  const disable = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: null }))
    await disablePushForThisDevice().catch(() => undefined)
    setState((s) => ({ ...s, subscribed: false, busy: false }))
  }, [])

  return { ...state, enable, disable }
}
