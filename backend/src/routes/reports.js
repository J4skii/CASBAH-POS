import { sql } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

// SA timezone
const TZ = 'Africa/Johannesburg'

export async function reportRoutes(app) {
  // ── Today's summary ───────────────────────────────────────────
  app.get('/reports/today/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    try {
      const [row] = await sql`
        SELECT
          COUNT(*)::int                                    AS order_count,
          COALESCE(SUM(total_cents), 0)::int               AS total_cents,
          COALESCE(SUM(vat_cents), 0)::int                 AS vat_cents,
          COALESCE(AVG(total_cents)::int, 0)               AS avg_order_cents,
          COALESCE(SUM(CASE WHEN payment_method = 'cash'       THEN total_cents END), 0)::int AS cash_cents,
          COALESCE(SUM(CASE WHEN payment_method = 'card_yoco'  THEN total_cents END), 0)::int AS yoco_cents,
          COALESCE(SUM(CASE WHEN payment_method = 'snapscan'   THEN total_cents END), 0)::int AS snapscan_cents,
          COALESCE(SUM(CASE WHEN payment_method = 'zapper'     THEN total_cents END), 0)::int AS zapper_cents
        FROM orders
        WHERE location_id = ${req.params.location_id}
          AND status != 'voided'
          AND DATE(created_at AT TIME ZONE ${TZ}) = (NOW() AT TIME ZONE ${TZ})::date
      `
      return row
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch today summary' })
    }
  })

  // ── Sales by day ──────────────────────────────────────────────
  app.get('/reports/sales/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    const { location_id } = req.params
    const startDate = req.query.start_date ?? new Date(Date.now() - 30 * 864e5).toISOString()
    const endDate   = req.query.end_date   ?? new Date().toISOString()

    try {
      const sales = await sql`
        SELECT
          DATE(created_at AT TIME ZONE ${TZ})    AS date,
          COUNT(*)::int                           AS order_count,
          SUM(total_cents)::int                   AS total_cents,
          SUM(vat_cents)::int                     AS vat_cents,
          AVG(total_cents)::int                   AS avg_order_cents
        FROM orders
        WHERE location_id = ${location_id}
          AND status != 'voided'
          AND created_at >= ${startDate}::timestamptz
          AND created_at <= ${endDate}::timestamptz
        GROUP BY DATE(created_at AT TIME ZONE ${TZ})
        ORDER BY date DESC
      `
      return { location_id, sales }
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch sales report' })
    }
  })

  // ── Top selling items ─────────────────────────────────────────
  app.get('/reports/top-items/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    const { location_id } = req.params
    const days = Math.max(1, Math.min(365, parseInt(req.query.days) || 7))

    try {
      return await sql`
        SELECT
          oi.item_name                                   AS name,
          SUM(oi.quantity)::int                          AS total_sold,
          SUM(oi.quantity * oi.unit_price_cents)::int    AS total_revenue_cents
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.location_id = ${location_id}
          AND o.status != 'voided'
          AND o.created_at >= NOW() - (${days} * INTERVAL '1 day')
        GROUP BY oi.item_id, oi.item_name
        ORDER BY total_sold DESC
        LIMIT 20
      `
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch top items' })
    }
  })

  // ── Hourly breakdown for today ────────────────────────────────
  app.get('/reports/hourly/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    try {
      return await sql`
        SELECT
          EXTRACT(HOUR FROM created_at AT TIME ZONE ${TZ})::int  AS hour,
          COUNT(*)::int                                            AS order_count,
          SUM(total_cents)::int                                    AS total_cents
        FROM orders
        WHERE location_id = ${req.params.location_id}
          AND status != 'voided'
          AND DATE(created_at AT TIME ZONE ${TZ}) = (NOW() AT TIME ZONE ${TZ})::date
        GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE ${TZ})
        ORDER BY hour
      `
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch hourly data' })
    }
  })
}
