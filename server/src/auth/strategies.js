/**
 * Strategy pattern: one class per way of proving who a user is.
 *
 * Every strategy has the same method, authenticate(credentials) -> user,
 * so AuthService can sign a user in without knowing whether the proof was a
 * password or a Google ID token. Adding another provider (e.g. Microsoft)
 * means writing one more strategy and registering it; AuthService does not
 * change.
 */
import { UnauthorizedError } from '../utils/errors.js'

export class LocalAuthStrategy {
  name = 'local'

  /**
   * @param {import('../repositories/UserRepository.js').UserRepository} users
   * @param {import('./PasswordHasher.js').PasswordHasher} passwordHasher
   */
  constructor(users, passwordHasher) {
    this.users = users
    this.passwordHasher = passwordHasher
  }

  async authenticate({ email, password }) {
    const user = await this.users.findByEmail(email, { withPassword: true })
    // Always run bcrypt, even for an unknown email (see PasswordHasher).
    const passwordMatches = await this.passwordHasher.verify(password, user?.passwordHash)

    // The same message for "no such email" and "wrong password", so the
    // response does not reveal which emails have accounts.
    if (!user || !user.passwordHash || !passwordMatches) {
      throw new UnauthorizedError('Email or password is incorrect.')
    }
    return user
  }
}

export class GoogleAuthStrategy {
  name = 'google'

  /**
   * @param {import('../repositories/UserRepository.js').UserRepository} users
   * @param {{ verify(idToken: string): Promise<{ sub: string, email: string, name: string, emailVerified: boolean }> }} googleVerifier
   */
  constructor(users, googleVerifier) {
    this.users = users
    this.googleVerifier = googleVerifier
  }

  /**
   * Signs in with a Google ID token. A first-time Google user gets an
   * account with the role they picked (donor or rescuer); an existing
   * email/password account with the same verified email is linked.
   */
  async authenticate({ credential, role }) {
    const profile = await this.googleVerifier.verify(credential)
    if (!profile.emailVerified) {
      throw new UnauthorizedError('Your Google email address is not verified.')
    }

    const byGoogleId = await this.users.findByGoogleId(profile.sub)
    if (byGoogleId) return byGoogleId

    const byEmail = await this.users.findByEmail(profile.email)
    if (byEmail) {
      return this.users.updateById(byEmail.id, { googleId: profile.sub })
    }

    return this.users.create({
      name: profile.name,
      email: profile.email,
      googleId: profile.sub,
      authProvider: 'google',
      role,
    })
  }
}
