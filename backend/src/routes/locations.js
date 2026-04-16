import { sql } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

export async function locationRoutes(app) {
  // ── Get location settings ────────────────────────────────────
  app.get('/locations/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    try {
      const [loc] = await sql`SELECT * FROM locations WHERE id = ${req.params.location_id}`
      if (!loc) return reply.status(404).send({ error: 'Location not found' })
      return loc
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch location' })
    }
  })

  // ── Update location settings (owner only) ───────────────────
  app.patch('/locations/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    if (req.user.role !== 'owner') {
      return reply.status(403).send({ error: 'Owner only' })
    }
    // Only allow updating own location
    if (req.params.location_id !== req.user.location_id) {
      return reply.status(403).send({ error: 'Cannot modify another location' })
    }

    const { name, address, city, phone, vat_number, yoco_public_key, snap_scan_merchant_id, zapper_merchant_id } = req.body ?? {}

    try {
      const [updated] = await sql`
        UPDATE locations SET
          name                   = COALESCE(${name                   ?? null}, name),
          address                = COALESCE(${address                ?? null}, address),
          city                   = COALESCE(${city                   ?? null}, city),
          phone                  = COALESCE(${phone                  ?? null}, phone),
          vat_number             = COALESCE(${vat_number             ?? null}, vat_number),
          yoco_public_key        = COALESCE(${yoco_public_key        ?? null}, yoco_public_key),
          snap_scan_merchant_id  = COALESCE(${snap_scan_merchant_id  ?? null}, snap_scan_merchant_id),
          zapper_merchant_id     = COALESCE(${zapper_merchant_id     ?? null}, zapper_merchant_id)
        WHERE id = ${req.params.location_id}
        RETURNING *
      `
      return updated
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to update location' })
    }
  })
}
