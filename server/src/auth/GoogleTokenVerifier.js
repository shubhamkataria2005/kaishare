/**
 * Adapter around google-auth-library.
 *
 * The browser gets an ID token (a JWT signed by Google) from "Sign in with
 * Google". This class checks the token's signature against Google's public
 * keys, its expiry, its issuer and that its audience is our own OAuth client
 * id, then returns the few profile fields the app needs. The rest of the
 * code depends on this small interface, not on the Google library.
 */
import { OAuth2Client } from 'google-auth-library'
import { UnauthorizedError } from '../utils/errors.js'

export class GoogleTokenVerifier {
  /** @param {string} clientId OAuth 2 client id from Google Cloud Console */
  constructor(clientId) {
    this.clientId = clientId
    this.client = new OAuth2Client(clientId)
  }

  get isConfigured() {
    return Boolean(this.clientId)
  }

  async verify(idToken) {
    if (!this.isConfigured) {
      throw new UnauthorizedError('Google sign-in is not enabled on this server.')
    }
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId })
      const payload = ticket.getPayload()
      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        emailVerified: payload.email_verified === true,
      }
    } catch {
      throw new UnauthorizedError('Google sign-in failed. Please try again.')
    }
  }
}
