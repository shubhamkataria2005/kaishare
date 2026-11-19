/**
 * All API routes. Each route lists its middleware chain in order:
 * rate limit -> authenticate -> authorize(role) -> validate -> controller.
 *
 * Express 5 forwards errors thrown in async handlers to the error handler,
 * so controllers do not need try/catch.
 */
import { Router } from 'express'
import { createAuthController } from '../controllers/authController.js'
import { createClaimController } from '../controllers/claimController.js'
import { createListingController } from '../controllers/listingController.js'
import { createPushController } from '../controllers/pushController.js'
import { getDatabaseStatus } from '../config/database.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { createAuthLimiter } from '../middleware/security.js'
import { validate } from '../middleware/validate.js'
import {
  broadcastSchema,
  createClaimSchema,
  createListingSchema,
  googleSignInSchema,
  idParamSchema,
  listingQuerySchema,
  loginSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  registerSchema,
  updateClaimSchema,
  updateListingSchema,
  updateProfileSchema,
} from '../validation/schemas.js'

/** @param {ReturnType<typeof import('../container.js').createContainer>} container */
export function createApiRouter(container) {
  const { config, services, tokenService } = container
  const router = Router()
  const requireAuth = authenticate(tokenService)
  const authLimiter = createAuthLimiter(config.isTest ? 1000 : 10)
  const byId = validate({ params: idParamSchema })

  // ---------- Health ----------
  router.get('/health', async (_req, res) => {
    const database = await getDatabaseStatus()
    const healthy = database.state === 'connected'
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      database,
    })
  })

  // ---------- Authentication ----------
  const auth = createAuthController(services.auth, config)
  router.get('/auth/providers', auth.providers)
  router.post('/auth/register', authLimiter, validate({ body: registerSchema }), auth.register)
  router.post('/auth/login', authLimiter, validate({ body: loginSchema }), auth.login)
  router.post('/auth/google', authLimiter, validate({ body: googleSignInSchema }), auth.google)
  router.post('/auth/refresh', auth.refresh)
  router.post('/auth/logout', auth.logout)
  router.get('/auth/me', requireAuth, auth.me)
  router.patch('/auth/me', requireAuth, validate({ body: updateProfileSchema }), auth.updateMe)

  // ---------- Feature 1: listings ----------
  const listings = createListingController(services.listings)
  router.get('/listings', requireAuth, validate({ query: listingQuerySchema }), listings.browse)
  router.get('/listings/mine', requireAuth, authorize('donor', 'admin'), listings.mine)
  router.get('/listings/:id', requireAuth, byId, listings.get)
  router.post('/listings', requireAuth, authorize('donor'), validate({ body: createListingSchema }), listings.create)
  router.patch(
    '/listings/:id',
    requireAuth,
    authorize('donor', 'admin'),
    validate({ params: idParamSchema, body: updateListingSchema }),
    listings.update,
  )
  router.delete('/listings/:id', requireAuth, authorize('donor', 'admin'), byId, listings.remove)

  // ---------- Feature 2: claims ----------
  const claims = createClaimController(services.claims)
  router.get('/claims', requireAuth, claims.list)
  router.get('/claims/:id', requireAuth, byId, claims.get)
  router.post('/claims', requireAuth, authorize('rescuer'), validate({ body: createClaimSchema }), claims.create)
  router.patch('/claims/:id', requireAuth, validate({ params: idParamSchema, body: updateClaimSchema }), claims.update)
  router.delete('/claims/:id', requireAuth, authorize('rescuer', 'admin'), byId, claims.remove)

  // ---------- Push notifications ----------
  const push = createPushController(services.notifications)
  router.get('/push/public-key', push.publicKey)
  router.get('/push/status', requireAuth, push.status)
  router.post('/push/subscriptions', requireAuth, validate({ body: pushSubscriptionSchema }), push.subscribe)
  router.delete('/push/subscriptions', requireAuth, validate({ body: pushUnsubscribeSchema }), push.unsubscribe)
  router.post('/push/test', requireAuth, push.test)
  router.post('/push/broadcast', requireAuth, authorize('admin'), validate({ body: broadcastSchema }), push.broadcast)

  return router
}
