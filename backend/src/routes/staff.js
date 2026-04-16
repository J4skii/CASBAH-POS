import bcrypt from 'bcrypt'
import { sql } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

export async function staffRoutes(app) {
  // ── List staff for location (manager+) ───────────────────────
  app.get('/staff/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
    if (!['manager', 'owner'].includes(req.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
    try {
      return await sql`
        SELECT id, username, role, active, created_at
        FROM users
        WHERE location_id = ${req.params.location_id}
        ORDER BY role, username
      `
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch staff' })
    }
  })

  // ── Update staff role / active status (owner only) ───────────
  app.patch('/staff/:user_id', { onRequest: [authenticate] }, async (req, reply) => {
    if (req.user.role !== 'owner') {
      return reply.status(403).send({ error: 'Owner only' })
    }
    const { active, role } = req.body ?? {}
    try {
      const [updated] = await sql`
        UPDATE users
        SET
          active = COALESCE(${active ?? null}, active),
          role   = COALESCE(${role   ?? null}, role)
        WHERE id = ${req.params.user_id}
        RETURNING id, username, role, active
      `
      if (!updated) return reply.status(404).send({ error: 'User not found' })
      return updated
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to update staff' })
    }
  })

  // ── Change own password ───────────────────────────────────────
  app.post('/staff/change-password', { onRequest: [authenticate] }, async (req, reply) => {
    const { current_password, new_password } = req.body ?? {}
    if (!current_password || !new_password) {
      return reply.status(400).send({ error: 'Both current and new password required' })
    }
    if (new_password.length < 6) {
      return reply.status(400).send({ error: 'New password must be at least 6 characters' })
    }

    try {
      const [user] = await sql`SELECT password_hash FROM users WHERE id = ${req.user.user_id}`
      const valid = await bcrypt.compare(current_password, user.password_hash)
      if (!valid) return reply.status(401).send({ error: 'Current password incorrect' })

      const hash = await bcrypt.hash(new_password, 12)
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${req.user.user_id}`
      return { success: true }
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to change password' })
    }
  })
}
