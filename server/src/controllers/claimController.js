/** HTTP layer for feature 2: pickup claims. */

/** @param {import('../services/ClaimService.js').ClaimService} claimService */
export function createClaimController(claimService) {
  return {
    async list(req, res) {
      res.json({ items: await claimService.list(req.user) })
    },

    async get(req, res) {
      res.json({ claim: await claimService.get(req.user, req.valid.params.id) })
    },

    async create(req, res) {
      const claim = await claimService.create(req.user, req.valid.body)
      res.status(201).location(`/api/claims/${claim.id}`).json({ claim })
    },

    async update(req, res) {
      res.json({ claim: await claimService.update(req.user, req.valid.params.id, req.valid.body) })
    },

    async remove(req, res) {
      await claimService.remove(req.user, req.valid.params.id)
      res.status(204).end()
    },
  }
}
