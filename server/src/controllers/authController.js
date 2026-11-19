/**
 * HTTP layer for authentication. Controllers only translate between HTTP
 * and the services: read validated input, call a service, send a response.
 *
 * The refresh token is never put in a response body. It travels only in an
 * httpOnly, SameSite=Strict cookie scoped to /api/auth:
 * - httpOnly: page JavaScript (and therefore an XSS attack) cannot read it;
 * - SameSite=Strict: other websites cannot make the browser send it (CSRF);
 * - Secure (in production): it is only ever sent over HTTPS;
 * - Path=/api/auth: it is not sent with any other request.
 */

/**
 * @param {import('../services/AuthService.js').AuthService} authService
 * @param {{ refreshToken: { cookieName: string, secure: boolean }, google: { clientId: string } }} config
 */
export function createAuthController(authService, config) {
  const { cookieName, secure } = config.refreshToken
  const cookieOptions = { httpOnly: true, secure, sameSite: 'strict', path: '/api/auth' }

  function sendSession(res, status, session) {
    res.cookie(cookieName, session.refreshToken, { ...cookieOptions, expires: session.refreshTokenExpiresAt })
    res.status(status).json({
      user: session.user,
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
    })
  }

  const meta = (req) => ({ userAgent: req.get('User-Agent') ?? '' })

  return {
    providers(_req, res) {
      res.json({ local: true, google: { enabled: Boolean(config.google.clientId), clientId: config.google.clientId || null } })
    },

    async register(req, res) {
      sendSession(res, 201, await authService.register(req.valid.body, meta(req)))
    },

    async login(req, res) {
      sendSession(res, 200, await authService.signIn('local', req.valid.body, meta(req)))
    },

    async google(req, res) {
      sendSession(res, 200, await authService.signIn('google', req.valid.body, meta(req)))
    },

    async refresh(req, res) {
      try {
        sendSession(res, 200, await authService.refresh(req.cookies?.[cookieName], meta(req)))
      } catch (error) {
        res.clearCookie(cookieName, cookieOptions)
        throw error
      }
    },

    async logout(req, res) {
      await authService.signOut(req.cookies?.[cookieName])
      res.clearCookie(cookieName, cookieOptions)
      res.status(204).end()
    },

    async me(req, res) {
      res.json({ user: await authService.getProfile(req.user.id) })
    },

    async updateMe(req, res) {
      res.json({ user: await authService.updateProfile(req.user.id, req.valid.body) })
    },
  }
}
