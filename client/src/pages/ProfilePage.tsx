/** Profile details, push notifications, and offline storage information. */
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/ApiError'
import { authApi } from '../api/authApi'
import { pushApi } from '../api/pushApi'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { FormField } from '../components/FormField'
import { useToast } from '../components/toast/useToast'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { getStorageSummary } from '../offline/offlineCache'
import type { FieldErrors } from '../types'
import { getRecentLogs } from '../utils/logger'

export function ProfilePage() {
  return (
    <section>
      <div className="page-head">
        <h1>Your profile</h1>
      </div>
      <div className="profile-grid">
        <ProfileForm />
        <NotificationsPanel />
        <OfflinePanel />
        <ActivityPanel />
      </div>
    </section>
  )
}

function ProfileForm() {
  const { user, status, updateUser } = useAuth()
  const toast = useToast()
  const [values, setValues] = useState({ name: user!.name, organisation: user!.organisation, suburb: user!.suburb, phone: user!.phone })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (values.name.trim().length < 2) return setErrors({ name: 'Name must be at least 2 characters.' })
    setSaving(true)
    setErrors({})
    try {
      const { user: updated } = await authApi.updateMe({ ...values, name: values.name.trim() })
      updateUser(updated)
      toast.success('Profile saved.')
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors)
      toast.error(error instanceof Error ? error.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  const set = (field: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value })

  return (
    <form className="card" onSubmit={handleSubmit} noValidate aria-label="Profile">
      <h2 className="h3">Details</h2>
      <p className="muted small">
        {user!.email} · <span className={`badge badge-role-${user!.role}`}>{user!.role}</span> · signed in with{' '}
        {user!.authProvider === 'google' ? 'Google' : 'email and password'}
      </p>
      <FormField label="Name" error={errors.name}>
        <input value={values.name} onChange={set('name')} />
      </FormField>
      <FormField label="Organisation" error={errors.organisation}>
        <input value={values.organisation} onChange={set('organisation')} />
      </FormField>
      <div className="grid-2">
        <FormField label="Suburb" error={errors.suburb}>
          <input value={values.suburb} onChange={set('suburb')} />
        </FormField>
        <FormField label="Phone" error={errors.phone}>
          <input type="tel" value={values.phone} onChange={set('phone')} />
        </FormField>
      </div>
      <button type="submit" className="button" disabled={saving || status === 'offline'}>
        {saving ? 'Saving…' : 'Save details'}
      </button>
    </form>
  )
}

function NotificationsPanel() {
  const { user } = useAuth()
  const toast = useToast()
  const push = usePushNotifications()
  const [broadcast, setBroadcast] = useState({ title: '', body: '' })

  const sendTest = async () => {
    try {
      const result = await pushApi.sendTest()
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send.')
    }
  }

  const sendBroadcast = async (event: FormEvent) => {
    event.preventDefault()
    if (!broadcast.title.trim() || !broadcast.body.trim()) return toast.error('Enter a title and a message.')
    try {
      const result = await pushApi.broadcast(broadcast.title.trim(), broadcast.body.trim())
      toast.success(`Broadcast: ${result.message}`)
      setBroadcast({ title: '', body: '' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send.')
    }
  }

  return (
    <div className="card">
      <h2 className="h3">Notifications</h2>
      <p className="muted small">
        {user!.role === 'rescuer'
          ? 'Get an alert the moment new food is posted, and when donors confirm your pickups.'
          : 'Get an alert when a rescuer claims your food or changes their pickup time.'}
      </p>
      {!push.supported && <Alert kind="warning">This browser does not support push notifications.</Alert>}
      {push.permission === 'denied' && <Alert kind="warning">Notifications are blocked for this site in your browser settings.</Alert>}
      {push.error && <Alert kind="error">{push.error}</Alert>}
      {push.supported && (
        <p>
          Status: <strong>{push.subscribed ? 'On for this device' : 'Off'}</strong>
        </p>
      )}
      <div className="actions">
        {push.supported && !push.subscribed && (
          <button type="button" className="button" disabled={push.busy} onClick={push.enable}>
            Turn on notifications
          </button>
        )}
        {push.subscribed && (
          <>
            <button type="button" className="button button-secondary" onClick={sendTest}>
              Send test notification
            </button>
            <button type="button" className="button button-danger" disabled={push.busy} onClick={push.disable}>
              Turn off
            </button>
          </>
        )}
      </div>

      {user!.role === 'admin' && (
        <form className="broadcast" onSubmit={sendBroadcast} noValidate aria-label="Broadcast">
          <h3 className="h4">Broadcast to everyone (admin)</h3>
          <FormField label="Title">
            <input maxLength={60} value={broadcast.title} onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })} />
          </FormField>
          <FormField label="Message">
            <input maxLength={200} value={broadcast.body} onChange={(e) => setBroadcast({ ...broadcast, body: e.target.value })} />
          </FormField>
          <button type="submit" className="button button-secondary">
            Send broadcast
          </button>
        </form>
      )}
    </div>
  )
}

interface StorageInfo {
  caches: { name: string; entries: number }[]
  cached: number
  queued: number
  usageKb: number | null
  quotaMb: number | null
  serviceWorker: string
}

/** Shows what is stored for offline use: Cache Storage and IndexedDB. */
function OfflinePanel() {
  const { user } = useAuth()
  const online = useOnlineStatus()
  const [info, setInfo] = useState<StorageInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const names = 'caches' in window ? await caches.keys() : []
      const cacheList = await Promise.all(names.map(async (name) => ({ name, entries: (await (await caches.open(name)).keys()).length })))
      const { cached, queued } = await getStorageSummary(user!.id)
      const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null
      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
      if (cancelled) return
      setInfo({
        caches: cacheList,
        cached,
        queued,
        usageKb: estimate?.usage ? Math.round(estimate.usage / 1024) : null,
        quotaMb: estimate?.quota ? Math.round(estimate.quota / 1024 / 1024) : null,
        serviceWorker: registration?.active ? `active (${registration.active.scriptURL.split('/').pop()})` : 'not active',
      })
    })().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user, online])

  return (
    <div className="card">
      <h2 className="h3">Offline storage</h2>
      <p className="muted small">KaiShare keeps the app and your recent data on this device so it works without a connection.</p>
      {!info ? (
        <p className="muted">Reading storage…</p>
      ) : (
        <dl className="facts compact">
          <div>
            <dt>Connection</dt>
            <dd>{online ? 'Online' : 'Offline'}</dd>
          </div>
          <div>
            <dt>Service worker</dt>
            <dd>{info.serviceWorker}</dd>
          </div>
          {info.caches.map((cache) => (
            <div key={cache.name}>
              <dt>Cache: {cache.name}</dt>
              <dd>{cache.entries} files</dd>
            </div>
          ))}
          <div>
            <dt>IndexedDB: saved screens</dt>
            <dd>{info.cached}</dd>
          </div>
          <div>
            <dt>IndexedDB: changes waiting</dt>
            <dd>{info.queued}</dd>
          </div>
          {info.usageKb !== null && (
            <div>
              <dt>Storage used</dt>
              <dd>
                {info.usageKb} KB of {info.quotaMb} MB
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}

function ActivityPanel() {
  const logs = getRecentLogs().slice(0, 12)
  return (
    <div className="card">
      <h2 className="h3">Recent activity (diagnostics)</h2>
      {logs.length === 0 ? (
        <p className="muted small">Nothing yet.</p>
      ) : (
        <ol className="log-list">
          {logs.map((entry, index) => (
            <li key={index} className={`log-${entry.level}`}>
              <time>{new Date(entry.time).toLocaleTimeString('en-NZ')}</time> <span className="log-area">[{entry.area}]</span> {entry.message}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
