/**
 * Creates and checks the two kinds of token the API uses.
 *
 * Access token: a JWT signed with HS256, valid for 15 minutes. The browser
 *   keeps it in memory only and sends it as "Authorization: Bearer ...".
 *   Its payload carries the user id (sub) and role for authorization.
 *
 * Refresh token: 48 random bytes, valid for 7 days, stored by the browser
 *   in an httpOnly cookie that JavaScript cannot read (so an XSS bug cannot
 *   steal it). The database stores only its SHA-256 hash.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'

// Pin the algorithm so tokens signed with another algorithm, or "none",
// are always rejected.
const ALGORITHM = 'HS256'

export class TokenService {
  /** @param {{ accessSecret: string, accessExpiresIn: string, issuer: string, audience: string }} jwtConfig */
  constructor(jwtConfig) {
    this.jwtConfig = jwtConfig
  }

  /** @param {{ id: string, role: string, name: string }} user */
  signAccessToken(user) {
    const { accessSecret, accessExpiresIn, issuer, audience } = this.jwtConfig
    return jwt.sign({ role: user.role, name: user.name }, accessSecret, {
      algorithm: ALGORITHM,
      subject: user.id,
      issuer,
      audience,
      expiresIn: accessExpiresIn,
      jwtid: randomUUID(),
    })
  }

  /**
   * @returns {{ sub: string, role: string, name: string, exp: number }}
   * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
   */
  verifyAccessToken(token) {
    const { accessSecret, issuer, audience } = this.jwtConfig
    const payload = jwt.verify(token, accessSecret, { algorithms: [ALGORITHM], issuer, audience })
    if (typeof payload === 'string' || !payload.sub || !payload.role) {
      throw new jwt.JsonWebTokenError('Token payload is incomplete.')
    }
    return payload
  }

  /** Expiry time of an access token, for the client's session timer. */
  getExpiry(token) {
    const { exp } = jwt.decode(token)
    return new Date(exp * 1000)
  }

  /** A new random refresh token and the hash to store for it. */
  createRefreshToken() {
    const token = randomBytes(48).toString('base64url')
    return { token, tokenHash: TokenService.hashToken(token) }
  }

  static hashToken(token) {
    return createHash('sha256').update(token).digest('hex')
  }
}
