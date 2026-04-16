import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db } from '../db/schema.js'
import { extractVAT } from '../lib/vat.js'
import { generateUUID } from '../lib/uuid.js'

function freshOrder() {
  return {
    id:                  generateUUID(),
    items:               [],
    subtotal_cents:      0,
    vat_cents:           0,
    total_cents:         0,  // = subtotal_cents (VAT already included in prices)
    payment_method:      null,
    cash_tendered_cents: null,
    change_cents:        null,
    notes:               '',
    terminal_id:         localStorage.getItem('mojatill_terminal') ?? 'web-1',
    sync_status:         'pending'
  }
}

function recalc(items) {
  const subtotal_cents = items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0)
  const vat_cents      = extractVAT(subtotal_cents)  // 15/115 of inclusive price
  return { subtotal_cents, vat_cents, total_cents: subtotal_cents }
}

export const useOrderStore = create(
  persist(
    (set, get) => ({
      current_order: freshOrder(),

      addItem: (item, quantity = 1, modifiers = {}) => {
        set((state) => {
          const modKey      = JSON.stringify(modifiers)
          const existingIdx = state.current_order.items.findIndex(
            (i) => i.item_id === item.id && JSON.stringify(i.modifiers) === modKey
          )
          const items = [...state.current_order.items]

          if (existingIdx >= 0) {
            items[existingIdx] = { ...items[existingIdx], quantity: items[existingIdx].quantity + quantity }
          } else {
            items.push({
              item_id:         item.id,
              name:            item.name,
              unit_price_cents: item.price_cents,
              quantity,
              modifiers
            })
          }

          return { current_order: { ...state.current_order, items, ...recalc(items) } }
        })
      },

      removeItem: (index) => {
        set((state) => {
          const items = state.current_order.items.filter((_, i) => i !== index)
          return { current_order: { ...state.current_order, items, ...recalc(items) } }
        })
      },

      updateQuantity: (index, quantity) => {
        set((state) => {
          const items = [...state.current_order.items]
          if (quantity <= 0) {
            items.splice(index, 1)
          } else {
            items[index] = { ...items[index], quantity }
          }
          return { current_order: { ...state.current_order, items, ...recalc(items) } }
        })
      },

      setNotes: (notes) =>
        set((state) => ({ current_order: { ...state.current_order, notes } })),

      completeSale: async (paymentMethod, cashTenderedCents = null) => {
        const order = get().current_order
        const user  = JSON.parse(localStorage.getItem('mojatill_user') ?? '{}')

        const finalOrder = {
          ...order,
          payment_method:      paymentMethod,
          cash_tendered_cents: cashTenderedCents,
          change_cents:        cashTenderedCents ? cashTenderedCents - order.total_cents : null,
          staff_id:            user.user_id,
          location_id:         user.location_id,
          paid_at:             new Date().toISOString()
        }

        try {
          // Persist locally first (works offline)
          await db.orders.put(finalOrder)
          for (const item of finalOrder.items) {
            await db.order_items.add({ order_id: finalOrder.id, ...item })
          }
          // Queue for backend sync
          await db.sync_queue.add({
            id:            generateUUID(),
            data:          finalOrder,
            status:        'pending',
            attempt_count: 0,
            created_at:    new Date().toISOString()
          })

          set({ current_order: freshOrder() })
          return { success: true, order: finalOrder }
        } catch (err) {
          console.error('[MojaTill] Failed to save order:', err)
          return { success: false, error: err.message }
        }
      },

      clearOrder: () => set({ current_order: freshOrder() })
    }),
    { name: 'mojatill-order' }
  )
)
