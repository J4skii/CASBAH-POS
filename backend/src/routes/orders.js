import { sql } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

export async function orderRoutes(app) {
  // ── Create / sync order ───────────────────────────────────────
  app.post('/orders', { onRequest: [authenticate] }, async (req, reply) => {
    const order = req.body
    const { user_id, location_id } = req.user

    if (!order?.id || !Array.isArray(order.items) || order.items.length === 0) {
      return reply.status(400).send({ error: 'Invalid order format' })
    }

    try {
      const result = await sql.begin(async (tx) => {
        // Check inventory for tracked items
        for (const item of order.items) {
          const inv = await tx`
            SELECT quantity FROM inventory
            WHERE item_id = ${item.item_id} AND location_id = ${location_id}
          `
          if (inv.length > 0 && inv[0].quantity < item.quantity) {
            const err = new Error(`Nie genoeg voorraad vir "${item.name}"`)
            err.code = 'INSUFFICIENT_STOCK'
            throw err
          }
        }

        // Insert order
        const [inserted] = await tx`
          INSERT INTO orders
            (id, location_id, staff_id, subtotal_cents, vat_cents, total_cents,
             payment_method, cash_tendered_cents, change_cents, status, terminal_id, notes)
          VALUES
            (${order.id}, ${location_id}, ${user_id},
             ${order.subtotal_cents}, ${order.vat_cents}, ${order.total_cents},
             ${order.payment_method},
             ${order.cash_tendered_cents ?? null},
             ${order.change_cents ?? null},
             'paid',
             ${order.terminal_id ?? null},
             ${order.notes ?? null})
          RETURNING *, order_number
        `

        // Insert line items + deduct inventory
        for (const item of order.items) {
          await tx`
            INSERT INTO order_items (order_id, item_id, item_name, quantity, unit_price_cents, modifiers)
            VALUES (${order.id}, ${item.item_id}, ${item.name}, ${item.quantity},
                    ${item.unit_price_cents}, ${JSON.stringify(item.modifiers ?? {})})
          `
          await tx`
            UPDATE inventory
            SET quantity = quantity - ${item.quantity}, last_sync = NOW()
            WHERE item_id = ${item.item_id} AND location_id = ${location_id}
          `
        }

        // Audit trail
        await tx`
          INSERT INTO sync_queue (location_id, terminal_id, data, status)
          VALUES (${location_id}, ${order.terminal_id ?? null}, ${JSON.stringify(order)}, 'synced')
        `

        return inserted
      })

      // Broadcast to KDS
      app.io.to(`location:${location_id}`).emit('order:created', {
        order_id:     result.id,
        order_number: result.order_number,
        items:        order.items,
        notes:        order.notes,
        created_at:   result.created_at
      })

      return { success: true, order_id: result.id, order_number: result.order_number, synced_at: new Date().toISOString() }
    } catch (err) {
      if (err.code === 'INSUFFICIENT_STOCK') {
        return reply.status(409).send({ error: err.message, code: 'INSUFFICIENT_STOCK' })
      }
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to process order' })
    }
  })

  // ── List orders for location ──────────────────────────────────
  app.get('/orders/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    const { location_id } = req.params
    const { date, status } = req.query

    try {
      return await sql`
        SELECT o.*, u.username as staff_name
        FROM orders o
        JOIN users u ON o.staff_id = u.id
        WHERE o.location_id = ${location_id}
          ${date   ? sql`AND DATE(o.created_at AT TIME ZONE 'Africa/Johannesburg') = ${date}::date` : sql``}
          ${status ? sql`AND o.status = ${status}` : sql``}
        ORDER BY o.created_at DESC
        LIMIT 200
      `
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch orders' })
    }
  })

  // ── Update order status (KDS / manager) ──────────────────────
  app.patch('/orders/:order_id/status', { onRequest: [authenticate] }, async (req, reply) => {
    const { order_id } = req.params
    const { status, location_id } = req.body

    const valid = ['preparing', 'ready', 'delivered', 'voided']
    if (!valid.includes(status)) {
      return reply.status(400).send({ error: 'Invalid status' })
    }

    try {
      const [updated] = await sql`
        UPDATE orders SET status = ${status} WHERE id = ${order_id} RETURNING *
      `
      if (!updated) return reply.status(404).send({ error: 'Order not found' })

      app.io.to(`location:${location_id ?? updated.location_id}`).emit('order:status', { order_id, status })
      return updated
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to update order' })
    }
  })
}
