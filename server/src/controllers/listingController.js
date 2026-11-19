/** HTTP layer for feature 1: surplus food listings. */

/** @param {import('../services/ListingService.js').ListingService} listingService */
export function createListingController(listingService) {
  return {
    async browse(req, res) {
      res.json(await listingService.browse(req.valid.query))
    },

    async mine(req, res) {
      res.json({ items: await listingService.listMine(req.user) })
    },

    async get(req, res) {
      res.json({ listing: await listingService.get(req.user, req.valid.params.id) })
    },

    async create(req, res) {
      const listing = await listingService.create(req.user, req.valid.body)
      res.status(201).location(`/api/listings/${listing.id}`).json({ listing })
    },

    async update(req, res) {
      res.json({ listing: await listingService.update(req.user, req.valid.params.id, req.valid.body) })
    },

    async remove(req, res) {
      await listingService.remove(req.user, req.valid.params.id)
      res.status(204).end()
    },
  }
}
