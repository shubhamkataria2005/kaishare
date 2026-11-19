/**
 * Web Push subscription helpers.
 *
 * subscribe flow:
 * 1. ask the user for notification permission;
 * 2. fetch the server's VAPID public key;
 * 3. pushManager.subscribe() creates a key pair inside the browser and
 *    returns an endpoint plus the public keys (p256dh, auth);
 * 4. send that subscription to the API, which stores it for this user.
 * The browser keeps its private key; the server encrypts each message with
 * the public one, so only this browser can decrypt it.
 */
import { pushApi } from '../api/pushApi'
import { createLogger } from '../utils/logger'

const log = createLogger('push')

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** VAPID keys are URL-safe base64; pushManager.subscribe needs raw bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normal = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normal)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function enablePush(): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('This browser does not support push notifications.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked. Allow them in your browser settings to turn them on.')
  }

  const registration = await navigator.serviceWorker.ready
  const { publicKey } = await pushApi.publicKey()
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))

  await pushApi.subscribe(subscription.toJSON())
  log.info('Push subscription saved on the server')
  return subscription
}

/** Removes this device's subscription from the server and the browser. */
export async function disablePushForThisDevice(): Promise<void> {
  const subscription = await getCurrentSubscription()
  if (!subscription) return
  await pushApi.unsubscribe(subscription.endpoint).catch((error) => log.warn('Server unsubscribe failed', error))
  await subscription.unsubscribe()
  log.info('Push subscription removed')
}
