/**
 * Composition root (Dependency Injection).
 *
 * This is the one place where concrete classes are created and wired
 * together. Every service receives its collaborators through its
 * constructor instead of importing them, so:
 * - tests can pass fakes through `overrides` (e.g. a fake push sender or a
 *   fake Google verifier) without any mocking library tricks;
 * - replacing an implementation (another database, another push provider)
 *   only changes this file.
 */
import { GoogleTokenVerifier } from './auth/GoogleTokenVerifier.js'
import { PasswordHasher } from './auth/PasswordHasher.js'
import { GoogleAuthStrategy, LocalAuthStrategy } from './auth/strategies.js'
import { TokenService } from './auth/TokenService.js'
import { EventBus } from './events/EventBus.js'
import { registerNotificationListeners } from './notifications/notificationListeners.js'
import { WebPushSender } from './notifications/WebPushSender.js'
import { ClaimRepository } from './repositories/ClaimRepository.js'
import { ListingRepository } from './repositories/ListingRepository.js'
import { PushSubscriptionRepository } from './repositories/PushSubscriptionRepository.js'
import { RefreshSessionRepository } from './repositories/RefreshSessionRepository.js'
import { UserRepository } from './repositories/UserRepository.js'
import { AuthService } from './services/AuthService.js'
import { ClaimService } from './services/ClaimService.js'
import { ListingService } from './services/ListingService.js'
import { NotificationService } from './services/NotificationService.js'
import { logger as defaultLogger } from './utils/logger.js'

/**
 * @param {ReturnType<typeof import('./config/env.js').loadConfig>} config
 * @param {{ pushSender?: object, googleVerifier?: object, passwordHasher?: object, logger?: object }} [overrides]
 */
export function createContainer(config, overrides = {}) {
  const logger = overrides.logger ?? defaultLogger

  const repositories = {
    users: new UserRepository(),
    listings: new ListingRepository(),
    claims: new ClaimRepository(),
    refreshSessions: new RefreshSessionRepository(),
    subscriptions: new PushSubscriptionRepository(),
  }

  const eventBus = new EventBus()
  const tokenService = new TokenService(config.jwt)
  const passwordHasher = overrides.passwordHasher ?? new PasswordHasher(config.bcryptRounds)
  const googleVerifier = overrides.googleVerifier ?? new GoogleTokenVerifier(config.google.clientId)
  const pushSender = overrides.pushSender ?? new WebPushSender(config.vapid)

  const services = {
    auth: new AuthService({
      users: repositories.users,
      refreshSessions: repositories.refreshSessions,
      tokenService,
      passwordHasher,
      strategies: [
        new LocalAuthStrategy(repositories.users, passwordHasher),
        new GoogleAuthStrategy(repositories.users, googleVerifier),
      ],
      refreshTokenDays: config.refreshToken.days,
      logger,
    }),
    listings: new ListingService({ listings: repositories.listings, claims: repositories.claims, eventBus }),
    claims: new ClaimService({ claims: repositories.claims, listings: repositories.listings, eventBus }),
    notifications: new NotificationService({
      subscriptions: repositories.subscriptions,
      users: repositories.users,
      sender: pushSender,
      publicKey: config.vapid.publicKey,
      logger,
    }),
  }

  registerNotificationListeners(eventBus, services.notifications, repositories.listings)

  return { config, logger, repositories, services, tokenService, eventBus }
}
