/// <reference lib="webworker" />
/**
 * KaiShare service worker.
 *
 * 1. Precaching (offline app shell): Workbox injects the list of built
 *    files into self.__WB_MANIFEST at build time. They are cached on
 *    install, so the app opens with no connection.
 * 2. Navigation fallback: any page URL (e.g. /claims) is answered with the
 *    cached index.html, and React Router shows the right page.
 * 3. Runtime caching for public, non-personal API data only. Personal data
 *    (listings, claims, profile) is never put in Cache Storage; the page
 *    keeps it in IndexedDB per user and deletes it on sign-out.
 * 4. Push: shows a notification for every push message (the payload was
 *    encrypted end-to-end and is decrypted by the browser), and opens the
 *    right page when the notification is clicked.
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

// ---------- 1. App shell ----------
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ---------- 2. Page navigations ----------
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

// ---------- 3. Runtime caching ----------
// Public configuration (sign-in providers, VAPID public key): show the last
// copy straight away and update it in the background.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && (url.pathname === '/api/auth/providers' || url.pathname === '/api/push/public-key'),
  new StaleWhileRevalidate({
    cacheName: 'kaishare-public-api',
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
)

// Images (icons) rarely change: serve from cache, keep at most 30 for 30 days.
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'kaishare-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
)

// ---------- Updates ----------
// The page asks before switching to a new version (see registerServiceWorker.ts).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ---------- 4. Push notifications ----------
interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  sentAt?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload
  try {
    payload = event.data?.json() as PushPayload
  } catch {
    payload = { title: 'KaiShare', body: event.data?.text() ?? 'You have a new update.' }
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: payload.tag,
        data: { url: payload.url ?? '/' },
      })
      // Also tell open tabs, so the app can show the message in-page.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      windows.forEach((client) => client.postMessage({ type: 'PUSH_RECEIVED', payload }))
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Only open paths inside this app.
  const path = String(event.notification.data?.url ?? '/')
  const target = new URL(path.startsWith('/') ? path : '/', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (existing) {
        await existing.focus()
        return existing.navigate(target)
      }
      return self.clients.openWindow(target)
    })(),
  )
})
