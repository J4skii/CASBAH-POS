/* ============================================
   POS BACKEND SCAFFOLD - Node.js + Fastify
   ============================================ */

// 1. MAIN SERVER (server.js)
// ============================================
import Fastify from 'fastify';
import postgres from 'postgres';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty'
    }
  }
});

// Database
const sql = postgres(process.env.DATABASE_URL);

// Plugins
await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-this'
});

await app.register(cors, {
  origin: true
});

// WebSocket (Socket.io for real-time KDS)
const io = new Server(app.server, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  console.log('📡 KDS connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('📡 KDS disconnected:', socket.id);
  });
});

// ============================================
// 2. HEALTH CHECK
// ============================================
app.get('/health', async (req, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// ============================================
// 3. AUTHENTICATION ROUTES
// ============================================
app.post('/api/auth/login', async (req, reply) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return reply.status(400).send({ error: 'Missing username or password' });
  }

  try {
    const users = await sql`
      SELECT id, username, password_hash, role FROM users WHERE username = ${username}
    `;

    if (users.length === 0) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user = users[0];
    // TODO: Compare password hash (bcrypt)
    // For MVP, skip password hashing
    if (password !== user.password_hash) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign({
      user_id: user.id,
      username: user.username,
      role: user.role
    });

    return {
      user_id: user.id,
      username: user.username,
      role: user.role,
      token
    };
  } catch (error) {
    app.log.error(error);
    return reply.status(500).send({ error: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, reply) => {
  const { username, password, location_id } = req.body;

  if (!username || !password) {
    return reply.status(400).send({ error: 'Missing fields' });
  }

  try {
    const result = await sql`
      INSERT INTO users (username, password_hash, role, location_id)
      VALUES (${username}, ${password}, 'cashier', ${location_id})
      RETURNING id, username, role
    `;

    return result[0];
  } catch (error) {
    app.log.error(error);
    if (error.message.includes('unique')) {
      return reply.status(409).send({ error: 'Username already exists' });
    }
    return reply.status(500).send({ error: 'Server error' });
  }
});

// Middleware: Verify JWT
async function authenticate(req, reply) {
  try {
    await req.jwtVerify();
  } catch (error) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

// ============================================
// 4. SYNC ENDPOINT (CRITICAL)
// ============================================
app.post('/api/orders', { onRequest: [authenticate] }, async (req, reply) => {
  const order = req.body;
  const user_id = req.user.user_id;

  if (!order || !order.id || !order.items || order.items.length === 0) {
    return reply.status(400).send({ error: 'Invalid order format' });
  }

  try {
    // Start transaction
    const result = await sql.begin(async (sql) => {
      // Check inventory before inserting
      for (const item of order.items) {
        const inventory = await sql`
          SELECT quantity FROM inventory WHERE item_id = ${item.item_id}
        `;

        if (!inventory || inventory[0].quantity < item.quantity) {
          throw new Error(`Insufficient stock for item ${item.item_id}`);
        }
      }

      // Insert order
      const inserted = await sql`
        INSERT INTO orders (id, location_id, staff_id, total_cents, paid_method, created_at)
        VALUES (${order.id}, ${order.location_id}, ${user_id}, ${order.total}, ${order.payment_method}, ${order.paid_at})
        RETURNING *
      `;

      // Insert order items
      for (const item of order.items) {
        await sql`
          INSERT INTO order_items (order_id, item_id, quantity, unit_price_cents, modifiers)
          VALUES (${order.id}, ${item.item_id}, ${item.quantity}, ${item.unit_price}, ${JSON.stringify(item.modifiers)})
        `;

        // Deduct from inventory
        await sql`
          UPDATE inventory SET quantity = quantity - ${item.quantity}
          WHERE item_id = ${item.item_id}
        `;
      }

      // Mark as synced
      await sql`
        INSERT INTO sync_queue (location_id, terminal_id, data, status)
        VALUES (${order.location_id}, ${order.terminal_id}, ${JSON.stringify(order)}, 'synced')
      `;

      return inserted[0];
    });

    // Broadcast to KDS (real-time)
    io.emit('order:created', {
      order_id: result.id,
      items: order.items,
      created_at: result.created_at
    });

    return {
      success: true,
      order_id: result.id,
      synced_at: new Date().toISOString()
    };
  } catch (error) {
    app.log.error(error);

    // Check if it's an inventory issue
    if (error.message.includes('stock')) {
      return reply.status(409).send({
        error: error.message,
        code: 'INSUFFICIENT_STOCK'
      });
    }

    return reply.status(500).send({ error: 'Failed to process order' });
  }
});

// ============================================
// 5. KITCHEN DISPLAY SYSTEM (WebSocket)
// ============================================
io.on('connection', (socket) => {
  console.log('KDS connected:', socket.id);

  // Subscribe to orders for this location
  socket.on('subscribe:location', (location_id) => {
    socket.join(`location:${location_id}`);
    console.log(`KDS subscribed to location ${location_id}`);
  });

  // Mark order as ready
  socket.on('order:ready', async (order_id) => {
    try {
      await sql`UPDATE orders SET status = 'ready' WHERE id = ${order_id}`;
      io.to(`location:*`).emit('order:ready', { order_id });
    } catch (error) {
      app.log.error('Failed to mark order ready:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('KDS disconnected:', socket.id);
  });
});

// ============================================
// 6. INVENTORY ROUTES
// ============================================
app.get('/api/inventory/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
  const { location_id } = req.params;

  try {
    const inventory = await sql`
      SELECT i.*, item.name
      FROM inventory i
      JOIN items item ON i.item_id = item.id
      WHERE i.location_id = ${location_id}
      ORDER BY item.name
    `;

    return inventory;
  } catch (error) {
    app.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch inventory' });
  }
});

app.patch('/api/inventory/:item_id', { onRequest: [authenticate] }, async (req, reply) => {
  const { item_id } = req.params;
  const { quantity, adjustment } = req.body;

  try {
    const update = adjustment
      ? await sql`UPDATE inventory SET quantity = quantity + ${adjustment} WHERE item_id = ${item_id} RETURNING *`
      : await sql`UPDATE inventory SET quantity = ${quantity} WHERE item_id = ${item_id} RETURNING *`;

    return update[0];
  } catch (error) {
    app.log.error(error);
    return reply.status(500).send({ error: 'Failed to update inventory' });
  }
});

// ============================================
// 7. REPORTS ROUTES
// ============================================
app.get('/api/reports/sales/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
  const { location_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    const sales = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(total_cents) as total_cents,
        AVG(total_cents) as avg_order_value
      FROM orders
      WHERE location_id = ${location_id}
        AND created_at >= ${start_date || '2024-01-01'}::date
        AND created_at <= ${end_date || 'now()'}::date
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    return { location_id, sales };
  } catch (error) {
    app.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch reports' });
  }
});

app.get('/api/reports/top-items/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
  const { location_id } = req.params;

  try {
    const topItems = await sql`
      SELECT 
        item.name,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.unit_price_cents) as total_revenue
      FROM order_items oi
      JOIN items item ON oi.item_id = item.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.location_id = ${location_id}
        AND o.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY item.id, item.name
      ORDER BY total_sold DESC
      LIMIT 20
    `;

    return topItems;
  } catch (error) {
    app.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch top items' });
  }
});

// ============================================
// 8. CATEGORY + ITEM ROUTES (For POS menu)
// ============================================
app.get('/api/categories/:location_id', async (req, reply) => {
  const { location_id } = req.params;

  try {
    const categories = await sql`
      SELECT * FROM categories WHERE location_id = ${location_id} ORDER BY sort_order
    `;
    return categories;
  } catch (error) {
    app.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/items/:location_id/:category_id', async (req, reply) => {
  const { location_id, category_id } = req.params;

  try {
    const items = await sql`
      SELECT i.*, inv.quantity as current_stock
      FROM items i
      LEFT JOIN inventory inv ON i.id = inv.item_id AND inv.location_id = ${location_id}
      WHERE i.category_id = ${category_id}
      ORDER BY i.sort_order
    `;
    return items;
  } catch (error) {
    app.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch items' });
  }
});

// ============================================
// 9. STAFF ROUTES
// ============================================
app.get('/api/staff/:location_id', { onRequest: [authenticate] }, async (req, reply) => {
  const { location_id } = req.params;

  try {
    const staff = await sql`
      SELECT id, username, role, created_at FROM users WHERE location_id = ${location_id}
    `;
    return staff;
  } catch (error) {
    app.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch staff' });
  }
});

// ============================================
// 10. ERROR HANDLING + SERVER START
// ============================================
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);
  reply.status(500).send({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`🚀 Server running on http://localhost:${PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

export default app;

/* ============================================
   DATABASE SCHEMA (schema.sql)
   ============================================ */

/*

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier', -- cashier, kitchen, manager, owner
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  category_id UUID NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  item_id UUID NOT NULL REFERENCES items(id),
  quantity INT NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'count',
  last_sync TIMESTAMP,
  UNIQUE(location_id, item_id)
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  staff_id UUID NOT NULL REFERENCES users(id),
  total_cents INT NOT NULL,
  paid_method TEXT NOT NULL, -- cash, card, digital
  status TEXT DEFAULT 'open', -- open, paid, ready, delivered
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  item_id UUID NOT NULL REFERENCES items(id),
  quantity INT NOT NULL,
  unit_price_cents INT NOT NULL,
  modifiers JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  terminal_id TEXT,
  data JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, synced, failed
  attempt_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_location_created ON orders(location_id, created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_inventory_location ON inventory(location_id);
CREATE INDEX idx_sync_queue_status ON sync_queue(status);

*/
