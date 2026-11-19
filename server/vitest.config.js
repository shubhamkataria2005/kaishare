import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Values the config module needs before any test file imports it.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://set-by-tests',
      JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-thirty-two-characters-long',
      VAPID_PUBLIC_KEY: 'test-public-key',
      VAPID_PRIVATE_KEY: 'test-private-key',
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      BCRYPT_ROUNDS: '4',
      LOG_LEVEL: 'error',
    },
    // The in-memory MongoDB is downloaded and started once per test file.
    hookTimeout: 120_000,
    testTimeout: 20_000,
    // Integration test files each start their own database, run them one at a time.
    fileParallelism: false,
    coverage: {
      include: ['src/**/*.js'],
      exclude: ['src/index.js'],
      reporter: ['text', 'html'],
    },
  },
})
