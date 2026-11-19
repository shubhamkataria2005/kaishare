/**
 * Registers the service worker (src/sw.ts) using vite-plugin-pwa's helper.
 *
 * When a new version has been downloaded, the app shows an "Update
 * available" banner instead of switching versions in the middle of
 * something; the user chooses when to reload.
 */
import { registerSW } from 'virtual:pwa-register'
import { createLogger } from '../utils/logger'

const log = createLogger('pwa')

export const PWA_EVENTS = {
  NEED_REFRESH: 'kaishare:need-refresh',
  OFFLINE_READY: 'kaishare:offline-ready',
} as const

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    log.warn('Service workers are not supported in this browser')
    return
  }

  updateServiceWorker = registerSW({
    onNeedRefresh() {
      log.info('A new version is ready')
      window.dispatchEvent(new Event(PWA_EVENTS.NEED_REFRESH))
    },
    onOfflineReady() {
      log.info('App shell cached: KaiShare works offline')
      window.dispatchEvent(new Event(PWA_EVENTS.OFFLINE_READY))
    },
    onRegisteredSW(url) {
      log.info(`Service worker registered (${url})`)
    },
    onRegisterError(error) {
      log.error('Service worker registration failed', error)
    },
  })
}

/** Activates the waiting service worker and reloads the page. */
export function applyUpdate() {
  void updateServiceWorker?.(true)
}
