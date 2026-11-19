/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Non-VITE_ variables from client/.env are only used here, in Node, and
  // are never bundled into the browser code.
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_TARGET || 'http://localhost:4000'

  // The dev and preview servers forward /api to the Express API, so the
  // browser talks to a single origin: no CORS preflights, and the
  // refresh-token cookie can be SameSite=Strict.
  const proxy = {
    '/api': {
      target: apiTarget,
      changeOrigin: false,
      // The local API may use a self-signed certificate (npm run cert).
      secure: false,
    },
  }

  return {
    plugins: [
      react(),
      VitePWA({
        // injectManifest: we write our own service worker (src/sw.ts) for
        // push notifications, and Workbox injects the precache list into it.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        // The app registers the worker itself (src/pwa/registerServiceWorker.ts)
        // and asks the user before activating a new version.
        injectRegister: false,
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'KaiShare – Surplus Food Rescue',
          short_name: 'KaiShare',
          description: 'Connects cafés and bakeries that have surplus food with charities and volunteers who can collect it.',
          theme_color: '#1d6b45',
          background_color: '#faf7f2',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          lang: 'en-NZ',
          categories: ['food', 'social', 'utilities'],
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: 'Browse food', url: '/', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
            { name: 'My claims', url: '/claims', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        },
        // Run the service worker in `npm run dev` as well, so offline
        // behaviour and push can be tested without a production build.
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: { sourcemap: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
    },
  }
})
