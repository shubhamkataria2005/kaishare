/**
 * State pattern (table-driven): which claim status changes are allowed,
 * who may make them, and what happens to the listing as a result.
 *
 *   pending   --confirm-->  confirmed   (listing stays reserved)
 *   pending   --decline-->  declined    (listing becomes available again)
 *   confirmed --decline-->  declined    (listing becomes available again)
 *   confirmed --collect-->  collected   (listing becomes collected)
 *
 * Keeping the rules in one table means a new status (e.g. "no-show") is
 * one new row here, not new if/else branches spread through ClaimService.
 */

/** @typedef {'pending' | 'confirmed' | 'declined' | 'collected'} ClaimStatus */

const TRANSITIONS = Object.freeze({
  pending: {
    confirmed: { by: ['donor', 'admin'], listing: null },
    declined: { by: ['donor', 'admin'], listing: { from: 'reserved', to: 'available' } },
  },
  confirmed: {
    collected: { by: ['donor', 'admin'], listing: { from: 'reserved', to: 'collected' } },
    declined: { by: ['donor', 'admin'], listing: { from: 'reserved', to: 'available' } },
  },
  declined: {},
  collected: {},
})

/** Statuses in which the claim still holds the listing. */
export const ACTIVE_CLAIM_STATUSES = Object.freeze(['pending', 'confirmed'])

/**
 * Looks up a transition.
 *
 * @param {ClaimStatus} from
 * @param {ClaimStatus} to
 * @returns {{ by: string[], listing: { from: string, to: string } | null } | null}
 *   the rule, or null when the change is not allowed
 */
export function getTransition(from, to) {
  return TRANSITIONS[from]?.[to] ?? null
}

/** The statuses a claim can move to next (used to show buttons in the UI). */
export function nextStatuses(from) {
  return Object.keys(TRANSITIONS[from] ?? {})
}

export function isActive(status) {
  return ACTIVE_CLAIM_STATUSES.includes(status)
}
