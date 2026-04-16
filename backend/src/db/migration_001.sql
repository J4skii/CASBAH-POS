-- ============================================
-- MojaTill Migration 001
-- Adds: modifiers_template, discounts, order_type, void_reason
-- Run: psql $DATABASE_URL -f migration_001.sql
-- ============================================

-- Modifier templates on menu items (array of groups)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS modifiers_template JSONB DEFAULT '[]';

-- Discount support on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_cents  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_note   TEXT;

-- Order type (dine in / takeaway / collection)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'dine_in'
    CHECK (order_type IN ('dine_in', 'takeaway', 'collection'));

-- Void reason
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Update orders CHECK to allow total < subtotal when discount applied
-- (The existing check total_cents >= 0 is sufficient; discount is tracked separately)

COMMENT ON COLUMN orders.discount_cents IS 'Discount amount in cents applied to this order';
COMMENT ON COLUMN orders.order_type     IS 'dine_in | takeaway | collection';
COMMENT ON COLUMN items.modifiers_template IS 'JSON array of modifier groups: [{name,required,multi_select,options:[{name,price_addon_cents}]}]';
