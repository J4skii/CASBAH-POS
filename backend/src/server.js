import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { Server } from 'socket.io'
import dotenv from 'dotenv'

import { sql } from './db/client.js'
import { authRoutes } from './routes/auth.js'
import { orderRoutes } from './routes/orders.js'
import { categoryRoutes } from './routes/categories.js'
import { inventoryRoutes } from './routes/inventory.js'
import { reportRoutes } from './routes/reports.js'
import { staffRoutes } from './routes/staff.js'
import { locationRoutes } from './routes/locations.js'

dotenv.config()

if (!process.env.JWT_SECRET) {
  console.error('❌  JWT_SECRET env var is not set. Copy .env.example → .env and set a secret.')
  process.exit(1)
}

const app = Fastify({
  logger: {
    level: 'info',
    transport: { target: 'pino-pretty' }
  }
})

// ── Plugins ──────────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true
})

await app.register(jwt, { secret: process.env.JWT_SECRET })

// ── Socket.io (KDS real-time) ─────────────────────────────────────
const io = new Server(app.server, {
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true
  }
})

// Make io accessible inside route handlers via app.io
app.decorate('io', io)

io.on('connection', (socket) => {
  app.log.info(`KDS connected: ${socket.id}`)

  // KDS subscribes to its location's room
  socket.on('subscribe:location', (location_id) => {
    socket.join(`location:${location_id}`)
    app.log.info(`KDS subscribed to location ${location_id}`)
  })

  // Kitchen marks order ready
  socket.on('order:ready', async ({ order_id, location_id }) => {
    try {
      await sql`UPDATE orders SET status = 'ready' WHERE id = ${order_id}`
      io.to(`location:${location_id}`).emit('order:status', { order_id, status: 'ready' })
    } catch (err) {
      app.log.error('Failed to mark order ready:', err)
    }
  })

  socket.on('disconnect', () => {
    app.log.info(`KDS disconnected: ${socket.id}`)
  })
})

// ── Health check ──────────────────────────────────────────────────
app.get('/health', async () => ({
  status:    'ok',
  service:   'MojaTill API',
  timestamp: new Date().toISOString()
}))

// ── Routes ────────────────────────────────────────────────────────
await app.register(authRoutes,      { prefix: '/api/auth' })
await app.register(orderRoutes,     { prefix: '/api' })
await app.register(categoryRoutes,  { prefix: '/api' })
await app.register(inventoryRoutes, { prefix: '/api' })
await app.register(reportRoutes,    { prefix: '/api' })
await app.register(staffRoutes,     { prefix: '/api' })
await app.register(locationRoutes,  { prefix: '/api' })

// ── Global error handler ──────────────────────────────────────────
app.setErrorHandler((error, _request, reply) => {
  app.log.error(error)
  reply.status(500).send({ error: 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000')
try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`\n🚀  MojaTill API running → http://localhost:${PORT}\n`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

export default app
