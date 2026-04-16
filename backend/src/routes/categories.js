import { sql } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

export async function categoryRoutes(app) {
  // ── Get categories for location ───────────────────────────────
  app.get('/categories/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    try {
      return await sql`
        SELECT * FROM categories
        WHERE location_id = ${req.params.location_id} AND active = true
        ORDER BY sort_order, name
      `
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch categories' })
    }
  })

  // ── Get items by category ─────────────────────────────────────
  app.get('/items/:location_id/:category_id', { onRequest: [authenticate] }, async (req, reply) => {
    const { location_id, category_id } = req.params
    try {
      return await sql`
        SELECT i.*, inv.quantity as current_stock, inv.low_stock_alert
        FROM items i
        LEFT JOIN inventory inv ON i.id = inv.item_id AND inv.location_id = ${location_id}
        WHERE i.category_id = ${category_id} AND i.active = true
        ORDER BY i.sort_order, i.name
      `
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch items' })
    }
  })

  // ── Get all items for location (for local DB sync) ────────────
  app.get('/items/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    try {
      return await sql`
        SELECT i.*, inv.quantity as current_stock
        FROM items i
        LEFT JOIN inventory inv ON i.id = inv.item_id AND inv.location_id = ${req.params.location_id}
        WHERE i.location_id = ${req.params.location_id} AND i.active = true
        ORDER BY i.sort_order, i.name
      `
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch items' })
    }
  })

  // ── Create category (manager+) ────────────────────────────────
  app.post('/categories', { onRequest: [authenticate] }, async (req, reply) => {
    if (!['manager', 'owner'].includes(req.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
    const { name, colour, sort_order } = req.body ?? {}
    if (!name) return reply.status(400).send({ error: 'Name required' })

    try {
      const [result] = await sql`
        INSERT INTO categories (location_id, name, colour, sort_order)
        VALUES (${req.user.location_id}, ${name}, ${colour ?? '#10B981'}, ${sort_order ?? 0})
        RETURNING *
      `
      return result
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to create category' })
    }
  })

  // ── Create item (manager+) ────────────────────────────────────
  app.post('/items', { onRequest: [authenticate] }, async (req, reply) => {
    if (!['manager', 'owner'].includes(req.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
    const { category_id, name, description, price_cents, sort_order, track_inventory } = req.body ?? {}
    if (!category_id || !name || price_cents == null) {
      return reply.status(400).send({ error: 'category_id, name and price_cents required' })
    }

    try {
      const [item] = await sql`
        INSERT INTO items (location_id, category_id, name, description, price_cents, sort_order, track_inventory)
        VALUES (${req.user.location_id}, ${category_id}, ${name}, ${description ?? null},
                ${price_cents}, ${sort_order ?? 0}, ${track_inventory ?? false})
        RETURNING *
      `
      if (track_inventory) {
        await sql`
          INSERT INTO inventory (location_id, item_id, quantity)
          VALUES (${req.user.location_id}, ${item.id}, 0)
          ON CONFLICT (location_id, item_id) DO NOTHING
        `
      }
      return item
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to create item' })
    }
  })

  // ── Update category (manager+) ───────────────────────────────
  app.patch('/categories/:category_id', { onRequest: [authenticate] }, async (req, reply) => {
    if (!['manager', 'owner'].includes(req.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
    const { name, colour, sort_order, active } = req.body ?? {}
    try {
      const [updated] = await sql`
        UPDATE categories SET
          name       = COALESCE(${name       ?? null}, name),
          colour     = COALESCE(${colour     ?? null}, colour),
          sort_order = COALESCE(${sort_order ?? null}, sort_order),
          active     = COALESCE(${active     ?? null}, active)
        WHERE id = ${req.params.category_id}
        RETURNING *
      `
      if (!updated) return reply.status(404).send({ error: 'Category not found' })
      return updated
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to update category' })
    }
  })

  // ── Update item (manager+) ────────────────────────────────────
  app.patch('/items/:item_id', { onRequest: [authenticate] }, async (req, reply) => {
    if (!['manager', 'owner'].includes(req.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
    const { name, description, price_cents, sort_order, active } = req.body ?? {}
    try {
      const [updated] = await sql`
        UPDATE items SET
          name        = COALESCE(${name        ?? null}, name),
          description = COALESCE(${description ?? null}, description),
          price_cents = COALESCE(${price_cents ?? null}, price_cents),
          sort_order  = COALESCE(${sort_order  ?? null}, sort_order),
          active      = COALESCE(${active      ?? null}, active)
        WHERE id = ${req.params.item_id}
        RETURNING *
      `
      if (!updated) return reply.status(404).send({ error: 'Item not found' })
      return updated
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to update item' })
    }
  })

  // ── Toggle inventory tracking on an item (manager+) ──────────
  app.post('/items/:item_id/toggle-inventory', { onRequest: [authenticate] }, async (req, reply) => {
    if (!['manager', 'owner'].includes(req.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
    try {
      const [item] = await sql`
        UPDATE items SET track_inventory = NOT track_inventory
        WHERE id = ${req.params.item_id} RETURNING *
      `
      if (!item) return reply.status(404).send({ error: 'Item not found' })
      if (item.track_inventory) {
        await sql`
          INSERT INTO inventory (location_id, item_id, quantity)
          VALUES (${req.user.location_id}, ${item.id}, 0)
          ON CONFLICT (location_id, item_id) DO NOTHING
        `
      }
      return item
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to toggle inventory tracking' })
    }
  })
}
