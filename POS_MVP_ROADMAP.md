# POS System MVP Roadmap
## 12-16 Week Build Plan (Solo/Small Team)

---

## MONTH 1: Foundation (Weeks 1–4)

### Week 1–2: Spike + Architecture
**Goal**: Prove offline sync works. Build tech confidence.

**Tasks**:
- [ ] Set up frontend repo (React + Zustand + IndexedDB)
- [ ] Set up backend repo (Node + Fastify + PostgreSQL)
- [ ] **Spike**: Write a proof-of-concept offline sync
  - Create 100 dummy transactions locally in IndexedDB
  - When online, batch-sync to backend
  - Verify conflict detection + last-write-wins
  - Test re-queuing on sync failure
  - **This is the critical piece — spend time here**
- [ ] Design database schema (orders, items, inventory, staff)
- [ ] Plan JWT auth flow (simple, no OAuth for MVP)

**Deliverable**: Runnable PoC showing transactions offline → online sync.

### Week 3–4: POS Checkout Core
**Goal**: Checkout works. Fast. No split bills yet.

**Tasks**:
- [ ] Build POS UI (React, single order at a time)
  - Big buttons for fast tapping
  - Category + item selection
  - Add modifiers (size, sauce, extra cheese, etc.)
  - Quantity increment/decrement
  - Quick keyboard number entry for common combos
- [ ] Shopping cart (in-memory, Zustand state)
- [ ] Order summary (items, subtotal, tax calc)
- [ ] Basic payment types (cash, card, digital)
- [ ] Receipt printer integration (thermal-printer library)
- [ ] Offline: All data stored locally, syncs on button click

**Deliverable**: Staff can ring items, take payment, print receipt. Works offline.

---

## MONTH 2: Kitchen + Sync (Weeks 5–8)

### Week 5–6: Kitchen Display System
**Goal**: Orders appear on KDS in real-time. No yelling.

**Tasks**:
- [ ] KDS screen layout (React)
  - Order queue (received → in-progress → ready)
  - Order number + items
  - Color coding by type (dine-in = blue, takeout = amber)
  - Prep time timer
  - "Ready" button (staff marks when order done)
- [ ] WebSocket connection (POS → KDS real-time)
- [ ] Order status sync
  - POS sends order → backend stores → KDS receives via WebSocket
  - KDS marks ready → POS shows on receipt/pickup list
- [ ] Offline KDS (can the screen still work without WiFi?)
  - For MVP: Yes, but limited to queued items in memory
  - Later: Add local KDS queue with sync

**Deliverable**: Ring an order on POS → appears on KDS screen instantly.

### Week 7–8: Robust Offline Sync
**Goal**: Sync engine is bulletproof.

**Tasks**:
- [ ] Implement full sync algorithm
  - Client detects online/offline via navigator.onLine + ping server
  - Queue transactions with timestamps + unique IDs
  - Batch sync (send all queued items every 30s when online)
  - Server validates + persists + returns success
  - Client removes from queue on success
  - Retry on failure with exponential backoff
  - Test: Unplug WiFi mid-sync, plug back in → auto-resume
- [ ] Conflict resolution for inventory
  - If two terminals sell last item of cola simultaneously while offline
  - Server detects conflict, marks one as failed
  - Client notifies staff: "Insufficient stock, order not placed"
- [ ] Data persistence across app restarts
  - IndexedDB survives browser close/app quit
  - On reopen, auto-resume sync for any queued items
- [ ] Audit log (every transaction, whether synced or not)

**Deliverable**: POS works in complete offline mode for 2–3 hours, full sync when online.

---

## MONTH 3: Inventory + Reports (Weeks 9–12)

### Week 9–10: Inventory Basics
**Goal**: Know what you have. Auto-deduct on sale.

**Tasks**:
- [ ] Inventory tracking (admin interface)
  - Add items with initial stock
  - Edit stock (manual adjustments, waste)
- [ ] Stock deduction on sale
  - When order syncs to backend, inventory -= quantity
  - Real-time view on admin dashboard
  - High/low stock alerts (if qty < 5, highlight red)
- [ ] Daily stock reconciliation (admin can manually count at EOD)
- [ ] Barcode scanning for fast inventory entry

**Deliverable**: Sell a burger → stock count drops immediately (when synced).

### Week 11–12: Reports + Dashboard
**Goal**: Owner sees what's selling, when.

**Tasks**:
- [ ] Dashboard homepage (admin only)
  - Today's sales summary (total, count of orders, avg order value)
  - Top 10 items sold today
  - Hourly sales chart (8am–11pm)
  - Staff sales comparison (who rang the most)
- [ ] Reports
  - Daily sales report (PDF export)
  - Weekly trend (is coffee slower on Mondays?)
  - Inventory snapshot (current stock levels)
  - Cash reconciliation (cash in vs. orders marked "cash")
- [ ] Basic charting library (Recharts or Chart.js)

**Deliverable**: Owner can see daily sales + top items in a clean dashboard.

---

## MONTH 4: Polish + Testing (Weeks 13–16)

### Week 13–14: Staff + Auth
**Goal**: Multiple users. Roles. Security.

**Tasks**:
- [ ] User management (admin creates staff accounts)
  - Cashier role (can ring sales)
  - Kitchen role (can mark orders ready)
  - Manager role (can access reports + inventory)
  - Owner role (all access)
- [ ] Staff login on POS terminal
  - Each transaction tagged with staff ID
  - Staff sales visibility on dashboard
- [ ] Clock in/out (mobile app or POS screen)
  - Track when staff starts/ends shift
  - Later: Use for labor analytics
- [ ] JWT tokens + secure API routes

**Deliverable**: Multi-user POS with roles. Each staff member has a login.

### Week 15–16: Testing + Edge Cases
**Goal**: Confident MVP. No surprises in field.

**Tasks**:
- [ ] Manual testing checklist
  - [ ] Offline checkout: can ring 10 items while WiFi off?
  - [ ] WiFi drop mid-transaction: does queue recover?
  - [ ] Two terminals offline simultaneously: do they sync without conflicts?
  - [ ] Receipt printer disconnected: error handling OK?
  - [ ] Rapid order entry (lunch rush simulation): responsive?
- [ ] Performance testing
  - [ ] Can KDS handle 50 concurrent orders?
  - [ ] Dashboard loads fast with 1000 orders in database?
  - [ ] Sync completes in <5s for 100 queued transactions?
- [ ] UAT with a test restaurant (1–2 shifts)
  - Real staff, real orders, real WiFi issues
  - Capture bugs + UX pain points
  - Iterate on feedback

**Deliverable**: Beta-ready POS. Runnable by actual restaurant staff.

---

## TECH STACK DETAILS

### Frontend

**Dependencies** (install):
```bash
npm install react react-dom zustand axios
npm install dexie  # IndexedDB wrapper (cleaner than native)
npm install recharts  # Charts
npm install shadcn/ui tailwindcss  # UI components
npm install react-native expo  # Mobile (later)
npm install socket.io-client  # WebSocket
```

**File structure**:
```
src/
├── components/
│   ├── POS/
│   │   ├── ItemSelector.jsx
│   │   ├── Cart.jsx
│   │   ├── PaymentModal.jsx
│   │   └── ReceiptPrinter.jsx
│   ├── KDS/
│   │   ├── OrderQueue.jsx
│   │   └── OrderDetails.jsx
│   ├── Admin/
│   │   ├── Dashboard.jsx
│   │   ├── Reports.jsx
│   │   └── Inventory.jsx
│   └── Auth/
│       └── Login.jsx
├── store/
│   ├── orderStore.js  # Current order state
│   ├── inventoryStore.js
│   └── syncStore.js  # Offline queue
├── db/
│   ├── schema.js  # Dexie tables
│   └── sync.js  # Sync engine
├── api/
│   └── client.js  # Axios + retry logic
└── App.jsx
```

### Backend

**Dependencies**:
```bash
npm install fastify
npm install postgres  # Or knex + pg
npm install redis
npm install jsonwebtoken
npm install socket.io
npm install dotenv
```

**File structure**:
```
src/
├── routes/
│   ├── auth.js
│   ├── orders.js
│   ├── inventory.js
│   ├── sync.js  # CRITICAL: Sync endpoint
│   ├── reports.js
│   └── health.js
├── db/
│   ├── schema.sql  # DDL
│   └── queries.js
├── services/
│   ├── sync.js  # Conflict resolution logic
│   ├── inventory.js
│   └── orders.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
└── server.js
```

### Database (PostgreSQL)

**Core tables**:
```sql
-- Users & Auth
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL, -- 'cashier', 'kitchen', 'manager', 'owner'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders (immutable ledger)
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  location_id UUID NOT NULL,
  staff_id UUID NOT NULL REFERENCES users(id),
  order_number INT NOT NULL,
  status TEXT DEFAULT 'open', -- 'open', 'paid', 'ready', 'delivered'
  total_cents INT NOT NULL,
  paid_method TEXT, -- 'cash', 'card', 'digital'
  synced_from_terminal TEXT, -- Terminal/device ID
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Order line items
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  item_id UUID NOT NULL,
  quantity INT NOT NULL,
  unit_price_cents INT NOT NULL,
  modifiers JSONB -- {size: 'large', sauce: 'bbq'}
);

-- Inventory
CREATE TABLE inventory (
  id UUID PRIMARY KEY,
  location_id UUID NOT NULL,
  item_id UUID NOT NULL,
  quantity INT NOT NULL,
  unit TEXT, -- 'count', 'ml', 'g'
  last_sync TIMESTAMP
);

-- Offline sync queue (tracks what's synced)
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY,
  location_id UUID,
  terminal_id TEXT,
  data JSONB, -- Full transaction
  status TEXT DEFAULT 'pending', -- 'pending', 'synced', 'failed'
  attempt_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## LAUNCH CHECKLIST

- [ ] Backend deployed (Railway, Render, or DigitalOcean)
- [ ] Frontend deployed (Vercel or Netlify)
- [ ] Database migrated to production
- [ ] SSL/TLS enabled (HTTPS only)
- [ ] Environment variables secured (no secrets in git)
- [ ] Receipt printer tested with real hardware
- [ ] Stripe sandbox payments working
- [ ] Backup strategy (automated PostgreSQL backups)
- [ ] Monitoring (error logging, uptime alerts)
- [ ] Documentation written (staff manual, admin guide)
- [ ] First restaurant go-live scheduled (2 terminals, 1 KDS)

---

## POST-MVP FEATURES (v1.1+)

### Quick Wins
- Split bills / multiple payments per order
- Delivery integrations (Uber Eats, DoorDash APIs)
- Advanced KDS (prep area routing, print tags)
- Staff scheduling module
- Detailed labor analytics

### Medium-Term
- Table management (reservation system for restaurants)
- Loyalty / punch card system
- Recipe management & food cost tracking
- Multi-location dashboard
- Custom receipt branding

### Later
- Mobile ordering (customer-facing app)
- Accounting export (QuickBooks integration)
- Predictive inventory (ML for reorder suggestions)
- Advanced labor forecasting
- Franchise support

---

## SUCCESS METRICS (For First 2 Customers)

- **Uptime**: 99.5%+ (goal: 99.9%)
- **Sync lag**: <2s from POS to KDS, <5s to backend
- **Offline duration**: Handle 4+ hours without WiFi
- **Staff training**: <15 min for new cashier
- **Support**: <30 min response for critical issues

---

## RESOURCES

**Design inspiration**:
- Square POS (clean, fast checkout)
- Toast POS (excellent KDS)
- Lightspeed Retail (inventory reporting)

**Libraries to evaluate**:
- Dexie.js (IndexedDB made easy)
- PouchDB (offline sync, more complex)
- Replicache (advanced sync, overkill for MVP)
- Socket.io vs native WebSocket (Socket.io for MVP, simpler)

**Hosting**:
- Frontend: Vercel (free tier, then $20/mo)
- Backend: Railway ($5/mo starter, scales up)
- Database: Supabase ($25/mo PostgreSQL) or Render ($15/mo)
- **Total monthly**: ~$45–60 for first 10 locations

---

## RISK MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Offline sync complexity** | 🔴 High | Build PoC first (Week 1–2). Test extensively. |
| **WiFi unreliability** | 🔴 High | Design POS to work fully offline. Queue heavily. |
| **Hardware compatibility** | 🟡 Medium | Test with actual receipt printers + card readers early. |
| **Staff resistance** | 🟡 Medium | Involve users in design. Prioritize ease of use. |
| **Data loss on device failure** | 🟡 Medium | Always sync to cloud. Never rely on local-only. |
| **Payment processing errors** | 🔴 High | Use Stripe/Square, never build own. Audit all txns. |

---

## FINAL NOTES

**This is ambitious but doable in 12–16 weeks solo.** The key:
1. **Offline sync is non-negotiable** — start there.
2. **No fancy features in MVP** — checkout, KDS, inventory basics only.
3. **Test with real staff** — let them break it before customers do.
4. **Deploy early and often** — weekly builds, not one big bang.

Once you have 5–10 restaurants using it reliably, you can:
- Refine based on real feedback (not guesses)
- Charge money confidently (people trust it)
- Hire a small team to scale

Good luck. This will be a game-changer for F&B. 🚀
