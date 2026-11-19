/**
 * Generates a VAPID key pair (an ECDSA P-256 key pair) for Web Push and
 * saves it into server/.env.
 *
 * - The public key is shared with browsers when they subscribe.
 * - The private key stays on the server (in .env, which is git-ignored) and
 *   signs every push request so push services know it came from us.
 *
 * Usage: npm run vapid            (keeps existing keys)
 *        npm run vapid -- --force (replaces them; browsers must re-subscribe)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateVAPIDKeys } from 'web-push'

const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env')
const force = process.argv.includes('--force')

let env = existsSync(envFile) ? readFileSync(envFile, 'utf8') : ''
const hasKeys = /^VAPID_PUBLIC_KEY=.+$/m.test(env) && /^VAPID_PRIVATE_KEY=.+$/m.test(env)

if (hasKeys && !force) {
  console.log('VAPID keys already exist in server/.env (use --force to replace them).')
  process.exit(0)
}

const { publicKey, privateKey } = generateVAPIDKeys()

for (const [name, value] of [
  ['VAPID_PUBLIC_KEY', publicKey],
  ['VAPID_PRIVATE_KEY', privateKey],
]) {
  const line = `${name}=${value}`
  env = new RegExp(`^${name}=.*$`, 'm').test(env) ? env.replace(new RegExp(`^${name}=.*$`, 'm'), line) : `${env.trimEnd()}\n${line}\n`
}

writeFileSync(envFile, env, { mode: 0o600 })
console.log('New VAPID keys saved to server/.env')
console.log(`Public key: ${publicKey}`)
console.log('Private key: (hidden, stored only in server/.env)')
