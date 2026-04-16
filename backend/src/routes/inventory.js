import { sql } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

export async function inventoryRoutes(app) {
  // ── Get full inventory for location ──────────────────────────
  app.get('/inventory/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    try {
      return await sql`
        SELECT inv.*, i.name, i.price_cents, i.active
        FROM inventory inv
        JOIN items i ON inv.item_id = i.id
        WHERE inv.location_id = ${req.params.location_id}
        ORDER BY i.name
      `
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch inventory' })
    }
  })

  // ── Update stock level (manager+) ────────────────────────────
  app.patch('/inventory/:item_id', { onRequest: [authenticate] }, async (req, reply) => {
    if (!['manager', 'owner'].includes(req.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }

    const { item_id } = req.params
    const { quantity, adjustment } = req.body ?? {}
    const { location_id } = req.user

    if (quantity == null && adjustment == null) {
      return reply.status(400).send({ error: 'Provide quantity (absolute) or adjustment (relative)' })
    }

    try {
      const [result] = adjustment != null
        ? await sql`
            UPDATE inventory
            SET quantity = GREATEST(0, quantity + ${adjustment}), last_sync = NOW()
            WHERE item_id = ${item_id} AND location_id = ${location_id}
            RETURNING *
          `
        : await sql`
            UPDATE inventory
            SET quantity = ${quantity}, last_sync = NOW()
            WHERE item_id = ${item_id} AND location_id = ${location_id}
            RETURNING *
          `

      if (!result) return reply.status(404).send({ error: 'Inventory record not found' })
      return result
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to update inventory' })
    }
  })
}
