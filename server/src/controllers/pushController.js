/** HTTP layer for Web Push subscriptions and notifications. */

/** @param {import('../services/NotificationService.js').NotificationService} notificationService */
export function createPushController(notificationService) {
  return {
    publicKey(_req, res) {
      res.json({ publicKey: notificationService.getPublicKey() })
    },

    async status(req, res) {
      res.json({
        configured: notificationService.sender.isConfigured,
        subscriptions: await notificationService.countForUser(req.user.id),
      })
    },

    async subscribe(req, res) {
      await notificationService.subscribe(req.user.id, req.valid.body, req.get('User-Agent') ?? '')
      res.status(201).json({ message: 'Notifications are on for this device.' })
    },

    async unsubscribe(req, res) {
      await notificationService.unsubscribe(req.user.id, req.valid.body.endpoint)
      res.status(204).end()
    },

    /** Sends a test notification to the signed-in user's own devices. */
    async test(req, res) {
      const result = await notificationService.sendToUsers([req.user.id], {
        title: 'KaiShare test notification',
        body: `Kia ora ${req.user.name}, push notifications are working on this device.`,
        url: '/profile',
        tag: 'test',
      })
      res.json({ message: `Sent to ${result.sent} device(s).`, ...result })
    },

    /** Admin only: sends a message to every user (all roles). */
    async broadcast(req, res) {
      const { title, body, url } = req.valid.body
      const result = await notificationService.sendToRoles(['donor', 'rescuer', 'admin'], { title, body, url: url ?? '/', tag: 'broadcast' })
      res.json({ message: `Sent to ${result.sent} device(s).`, ...result })
    },
  }
}
