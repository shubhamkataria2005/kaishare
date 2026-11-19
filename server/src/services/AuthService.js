/**
 * Registration, sign-in, token refresh and sign-out.
 *
 * Sign-in is delegated to a strategy (LocalAuthStrategy or
 * GoogleAuthStrategy, see auth/strategies.js); after any successful
 * sign-in this service issues the same session: a short-lived access
 * token plus a rotating refresh token.
 */
import { randomUUID } from 'node:crypto'
import { TokenService } from '../auth/TokenService.js'
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors.js'

const DAY_MS = 24 * 60 * 60 * 1000

export class AuthService {
  /**
   * @param {{
   *   users: import('../repositories/UserRepository.js').UserRepository,
   *   refreshSessions: import('../repositories/RefreshSessionRepository.js').RefreshSessionRepository,
   *   tokenService: TokenService,
   *   passwordHasher: import('../auth/PasswordHasher.js').PasswordHasher,
   *   strategies: Array<{ name: string, authenticate(credentials: object): Promise<any> }>,
   *   refreshTokenDays: number,
   *   logger: import('winston').Logger,
   * }} deps
   */
  constructor({ users, refreshSessions, tokenService, passwordHasher, strategies, refreshTokenDays, logger }) {
    this.users = users
    this.refreshSessions = refreshSessions
    this.tokenService = tokenService
    this.passwordHasher = passwordHasher
    this.strategies = new Map(strategies.map((strategy) => [strategy.name, strategy]))
    this.refreshTokenDays = refreshTokenDays
    this.logger = logger
  }

  /** Creates an email/password account and signs the new user in. */
  async register({ name, email, password, role, organisation, suburb, phone }, meta = {}) {
    if (await this.users.findByEmail(email)) {
      throw new ConflictError('An account with this email already exists.')
    }
    const passwordHash = await this.passwordHasher.hash(password)
    const user = await this.users.create({
      name,
      email,
      passwordHash,
      role,
      organisation,
      suburb,
      phone,
      authProvider: 'local',
    })
    this.logger.info('User registered', { userId: user.id, role })
    return this.issueSession(user, { userAgent: meta.userAgent })
  }

  /**
   * Signs in with the named strategy ("local" or "google").
   *
   * @param {string} strategyName
   * @param {object} credentials whatever that strategy needs
   */
  async signIn(strategyName, credentials, meta = {}) {
    const strategy = this.strategies.get(strategyName)
    if (!strategy) throw new ValidationError(`Unknown sign-in method "${strategyName}".`)

    const user = await strategy.authenticate(credentials)
    this.logger.info('User signed in', { userId: user.id, method: strategyName })
    return this.issueSession(user, { userAgent: meta.userAgent })
  }

  /**
   * Swaps a refresh token for a new access token and a new refresh token
   * (rotation). Using the same refresh token twice means it was stolen or
   * replayed, so every token from that sign-in is revoked.
   */
  async refresh(refreshToken, meta = {}) {
    if (!refreshToken) throw new UnauthorizedError('Your session has ended. Please sign in again.')

    const session = await this.refreshSessions.findByHash(TokenService.hashToken(refreshToken))
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedError('Your session has ended. Please sign in again.')
    }

    // markUsed only succeeds once per token, even under concurrent requests.
    const claimed = session.usedAt ? null : await this.refreshSessions.markUsed(session.id)
    if (!claimed) {
      await this.refreshSessions.revokeFamily(session.family)
      this.logger.warn('Refresh token reuse detected; session family revoked', { userId: session.user.toString() })
      throw new UnauthorizedError('Your session has ended. Please sign in again.')
    }

    const user = await this.users.findById(session.user.toString())
    if (!user) throw new UnauthorizedError('Your account no longer exists.')

    return this.issueSession(user, { family: session.family, userAgent: meta.userAgent })
  }

  /** Revokes the refresh token's whole sign-in (this device). */
  async signOut(refreshToken) {
    if (!refreshToken) return
    const session = await this.refreshSessions.findByHash(TokenService.hashToken(refreshToken))
    if (session) await this.refreshSessions.revokeFamily(session.family)
  }

  async getProfile(userId) {
    const user = await this.users.findById(userId)
    if (!user) throw new NotFoundError('Account not found.')
    return user.toPublic()
  }

  async updateProfile(userId, changes) {
    const user = await this.users.updateById(userId, changes)
    if (!user) throw new NotFoundError('Account not found.')
    return user.toPublic()
  }

  /** @private */
  async issueSession(user, { family = randomUUID(), userAgent = '' } = {}) {
    const accessToken = this.tokenService.signAccessToken(user)
    const { token: refreshToken, tokenHash } = this.tokenService.createRefreshToken()
    const refreshTokenExpiresAt = new Date(Date.now() + this.refreshTokenDays * DAY_MS)

    await this.refreshSessions.create({
      user: user.id,
      tokenHash,
      family,
      expiresAt: refreshTokenExpiresAt,
      userAgent: userAgent.slice(0, 300),
    })

    return {
      user: user.toPublic(),
      accessToken,
      accessTokenExpiresAt: this.tokenService.getExpiry(accessToken),
      refreshToken,
      refreshTokenExpiresAt,
    }
  }
}
