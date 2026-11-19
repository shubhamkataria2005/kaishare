/**
 * Hashes and checks passwords with bcrypt (salted and deliberately slow,
 * which makes brute-forcing a stolen hash expensive).
 */
import bcrypt from 'bcryptjs'

export class PasswordHasher {
  /** @param {number} rounds bcrypt cost factor (12 in production, low in tests) */
  constructor(rounds) {
    this.rounds = rounds
    // A real hash to compare against when the email is unknown, so a login
    // for a missing account takes as long as one for an existing account
    // (no timing difference that reveals which emails are registered).
    this.dummyHash = bcrypt.hashSync('kaishare-dummy-password', rounds)
  }

  async hash(password) {
    return bcrypt.hash(password, this.rounds)
  }

  async verify(password, hash) {
    return bcrypt.compare(password, hash ?? this.dummyHash)
  }
}
