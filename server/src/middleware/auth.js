/**
 * Authentication and authorization middleware.
 *
 * authenticate(tokenService) -> checks the Bearer access token and puts
 *   { id, role, name } on req.user. Responds 401 when it is missing,
 *   invalid or expired.
 * authorize(...roles) -> lets the request through only when req.user has
 *   one of the roles. Responds 403 otherwise (signed in, but not allowed).
 *
 * The middleware chain on a route (authenticate -> authorize -> validate ->
 * controller) is a Chain of Responsibility: each step either handles the
 * request (rejects it) or passes it to the next one.
 */
import jwt from 'jsonwebtoken'
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js'

/** @param {import('../auth/TokenService.js').TokenService} tokenService */
export function authenticate(tokenService) {
  return (req, res, next) => {
    const [scheme, token] = (req.get('Authorization') ?? '').split(' ')

    // The scheme name is case-insensitive (RFC 7235).
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      res.set('WWW-Authenticate', 'Bearer realm="kaishare"')
      return next(new UnauthorizedError('Authentication token is missing. Please sign in.'))
    }

    try {
      const payload = tokenService.verifyAccessToken(token)
      req.user = { id: payload.sub, role: payload.role, name: payload.name }
      next()
    } catch (error) {
      res.set('WWW-Authenticate', 'Bearer realm="kaishare", error="invalid_token"')
      const message =
        error instanceof jwt.TokenExpiredError
          ? 'Your session has expired. Please sign in again.'
          : 'Authentication token is invalid. Please sign in again.'
      next(new UnauthorizedError(message))
    }
  }
}

/** @param {...('donor' | 'rescuer' | 'admin')} roles */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError())
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Only ${roles.join(' or ')} accounts can do that.`))
    }
    next()
  }
}
