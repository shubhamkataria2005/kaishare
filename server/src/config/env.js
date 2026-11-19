/**
 * Reads and validates the environment variables the API needs.
 *
 * The values come from server/.env (loaded by `node --env-file`) or from the
 * real environment in production. Everything is checked once at start-up so
 * a missing secret stops the server immediately with a clear message,
 * instead of failing later in the middle of a request.
 */
import { z } from 'zod'

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // MongoDB: a local replica set in development, MongoDB Atlas in the cloud.
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // JWT access tokens (short-lived, sent in the Authorization header).
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_ISSUER: z.string().default('kaishare-api'),
  JWT_AUDIENCE: z.string().default('kaishare-web'),

  // Refresh tokens (long-lived, kept in an httpOnly cookie, rotated on use).
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: booleanString,

  // Google OAuth 2 (Sign in with Google). Optional: Google sign-in is
  // switched off when no client id is set.
  GOOGLE_CLIENT_ID: z.string().optional().default(''),

  // Web Push (VAPID) keys. Generate them with `npm run vapid`.
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().default('mailto:admin@kaishare.nz'),

  // Comma-separated list of browser origins allowed to call the API.
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4173'),

  // Optional HTTPS for the API itself (paths to a key and certificate).
  HTTPS_KEY_FILE: z.string().optional().default(''),
  HTTPS_CERT_FILE: z.string().optional().default(''),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
})

/**
 * Parses an environment object into the typed config used by the app.
 * Exported for unit tests; the app uses the `config` constant below.
 *
 * @param {NodeJS.ProcessEnv} env
 */
export function loadConfig(env) {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`)
  }
  const e = result.data

  return Object.freeze({
    env: e.NODE_ENV,
    isProduction: e.NODE_ENV === 'production',
    isTest: e.NODE_ENV === 'test',
    port: e.PORT,
    mongoUri: e.MONGODB_URI,
    jwt: Object.freeze({
      accessSecret: e.JWT_ACCESS_SECRET,
      accessExpiresIn: e.JWT_ACCESS_EXPIRES_IN,
      issuer: e.JWT_ISSUER,
      audience: e.JWT_AUDIENCE,
    }),
    refreshToken: Object.freeze({
      days: e.REFRESH_TOKEN_DAYS,
      cookieName: 'kaishare_rt',
      // Secure cookies are only sent over HTTPS; always on in production.
      secure: e.NODE_ENV === 'production' || e.COOKIE_SECURE,
    }),
    google: Object.freeze({ clientId: e.GOOGLE_CLIENT_ID }),
    vapid: Object.freeze({
      publicKey: e.VAPID_PUBLIC_KEY,
      privateKey: e.VAPID_PRIVATE_KEY,
      subject: e.VAPID_SUBJECT,
    }),
    corsOrigins: e.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    https: Object.freeze({ keyFile: e.HTTPS_KEY_FILE, certFile: e.HTTPS_CERT_FILE }),
    logLevel: e.LOG_LEVEL,
    bcryptRounds: e.BCRYPT_ROUNDS,
  })
}

export const config = loadConfig(process.env)
