import bcrypt from 'bcrypt'
import { sql } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

export async function authRoutes(app) {
  // ── Login ──────────────────────────────────────────────────────
  app.post('/login', async (req, reply) => {
    const { username, password } = req.body ?? {}

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' })
    }

    try {
      const users = await sql`
        SELECT u.id, u.username, u.password_hash, u.role, u.location_id,
               l.yoco_public_key, l.snap_scan_merchant_id, l.zapper_merchant_id, l.name as location_name
        FROM users u
        JOIN locations l ON u.location_id = l.id
        WHERE u.username = ${username.toLowerCase()} AND u.active = true
      `

      if (users.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const user = users[0]
      const valid = await bcrypt.compare(password, user.password_hash)

      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const token = app.jwt.sign(
        { user_id: user.id, username: user.username, role: user.role, location_id: user.location_id },
        { expiresIn: '12h' }
      )

      return {
        user_id:               user.id,
        username:              user.username,
        role:                  user.role,
        location_id:           user.location_id,
        location_name:         user.location_name,
        yoco_public_key:       user.yoco_public_key,
        snap_scan_merchant_id: user.snap_scan_merchant_id,
        zapper_merchant_id:    user.zapper_merchant_id,
        token
      }
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Server error' })
    }
  })

  // ── Register (manager/owner only) ─────────────────────────────
  app.post('/register', { onRequest: [authenticate] }, async (req, reply) => {
    const { username, password, role = 'cashier', location_id } = req.body ?? {}

    if (!['manager', 'owner'].includes(req.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' })
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters' })
    }

    try {
      const hash = await bcrypt.hash(password, 12)
      const result = await sql`
        INSERT INTO users (username, password_hash, role, location_id)
        VALUES (${username.toLowerCase()}, ${hash}, ${role}, ${location_id ?? req.user.location_id})
        RETURNING id, username, role, location_id
      `
      return result[0]
    } catch (err) {
      if (err.message?.includes('unique')) {
        return reply.status(409).send({ error: 'Username already taken' })
      }
      app.log.error(err)
      return reply.status(500).send({ error: 'Server error' })
    }
  })

  // ── Bootstrap: create first owner (only when no users exist) ──
  app.post('/bootstrap', async (req, reply) => {
    const { username, password, location_name } = req.body ?? {}

    const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM users`
    if (count > 0) {
      return reply.status(403).send({ error: 'System already initialised' })
    }

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' })
    }

    try {
      const [location] = await sql`
        INSERT INTO locations (name) VALUES (${location_name ?? 'My Restaurant'})
        RETURNING id
      `
      const hash = await bcrypt.hash(password, 12)
      const [user] = await sql`
        INSERT INTO users (username, password_hash, role, location_id)
        VALUES (${username.toLowerCase()}, ${hash}, 'owner', ${location.id})
        RETURNING id, username, role, location_id
      `
      const token = app.jwt.sign(
        { user_id: user.id, username: user.username, role: 'owner', location_id: location.id },
        { expiresIn: '12h' }
      )
      return { ...user, token }
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Server error' })
    }
  })

  // ── Me ────────────────────────────────────────────────────────
  app.get('/me', { onRequest: [authenticate] }, async (req) => ({
    user_id:     req.user.user_id,
    username:    req.user.username,
    role:        req.user.role,
    location_id: req.user.location_id
  }))
}
