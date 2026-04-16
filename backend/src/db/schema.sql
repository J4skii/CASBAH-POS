-- ============================================
-- MojaTill Database Schema
-- South African F&B POS System
-- All monetary values stored in CENTS (ZAR)
-- VAT: 15% inclusive (standard SA restaurant rate)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  address       TEXT,
  city          TEXT,
  phone         TEXT,
  vat_number    TEXT,                 -- SA VAT registration number (SARS)
  yoco_public_key        TEXT,        -- Yoco publishable key (safe to expose)
  snap_scan_merchant_id  TEXT,        -- SnapScan merchant code
  zapper_merchant_id     TEXT,        -- Zapper merchant ID
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'cashier'
                  CHECK (role IN ('cashier', 'kitchen', 'manager', 'owner')),
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  colour        TEXT DEFAULT '#10B981',  -- hex colour for UI tab
  sort_order    INT DEFAULT 0,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES categories(id),
  name            TEXT NOT NULL,
  description     TEXT,
  price_cents     INT NOT NULL CHECK (price_cents >= 0),  -- VAT INCLUSIVE
  sort_order      INT DEFAULT 0,
  active          BOOLEAN DEFAULT true,
  track_inventory BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_id          UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity         INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  low_stock_alert  INT DEFAULT 5,
  last_sync        TIMESTAMPTZ,
  UNIQUE(location_id, item_id)
);

CREATE TABLE orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID NOT NULL REFERENCES locations(id),
  staff_id              UUID NOT NULL REFERENCES users(id),
  order_number          SERIAL,          -- Human-readable number shown on KDS
  subtotal_cents        INT NOT NULL CHECK (subtotal_cents >= 0),
  vat_cents             INT NOT NULL CHECK (vat_cents >= 0),  -- 15/115 of subtotal
  total_cents           INT NOT NULL CHECK (total_cents >= 0), -- = subtotal (VAT inclusive)
  payment_method        TEXT NOT NULL
                          CHECK (payment_method IN ('cash', 'card_yoco', 'snapscan', 'zapper')),
  cash_tendered_cents   INT,   -- cash payments only
  change_cents          INT,   -- cash payments only
  status                TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','paid','preparing','ready','delivered','voided')),
  terminal_id           TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id           UUID NOT NULL REFERENCES items(id),
  item_name         TEXT NOT NULL,         -- snapshot — item name may change later
  quantity          INT NOT NULL CHECK (quantity > 0),
  unit_price_cents  INT NOT NULL CHECK (unit_price_cents >= 0),  -- VAT inclusive
  modifiers         JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sync_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL REFERENCES locations(id),
  terminal_id    TEXT,
  data           JSONB NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'synced', 'failed')),
  attempt_count  INT DEFAULT 0,
  error_message  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_orders_location_created  ON orders(location_id, created_at DESC);
CREATE INDEX idx_orders_status            ON orders(status);
CREATE INDEX idx_order_items_order        ON order_items(order_id);
CREATE INDEX idx_inventory_location       ON inventory(location_id);
CREATE INDEX idx_sync_queue_status        ON sync_queue(status, created_at);
CREATE INDEX idx_items_category           ON items(category_id, sort_order);
CREATE INDEX idx_categories_location      ON categories(location_id, sort_order);

-- ============================================
-- AUTO-UPDATE updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sync_queue_updated_at
  BEFORE UPDATE ON sync_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
