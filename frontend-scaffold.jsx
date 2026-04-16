/* ============================================
   POS FRONTEND SCAFFOLD - React + Zustand + Dexie
   ============================================ */

// 1. DATABASE SCHEMA (db/schema.js)
// ============================================
import Dexie from 'dexie';

export const db = new Dexie('POS_DB');

db.version(1).stores({
  orders: '++id, location_id, created_at',
  order_items: '++id, order_id',
  inventory: '++id, location_id, item_id',
  sync_queue: '++id, status, created_at',
  categories: '++id, name',
  items: '++id, category_id'
});

// 2. STATE MANAGEMENT (store/orderStore.js)
// ============================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useOrderStore = create(
  persist(
    (set, get) => ({
      // Current order being built
      current_order: {
        id: generateUUID(),
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        payment_method: null,
        paid_at: null,
        terminal_id: localStorage.getItem('terminal_id'),
        staff_id: localStorage.getItem('staff_id'),
        sync_status: 'pending' // 'pending', 'synced', 'failed'
      },

      // Add item to cart
      addItem: (item, quantity = 1, modifiers = {}) => {
        set((state) => {
          const existingIdx = state.current_order.items.findIndex(
            (i) => i.item_id === item.id && JSON.stringify(i.modifiers) === JSON.stringify(modifiers)
          );

          let newItems = [...state.current_order.items];
          if (existingIdx >= 0) {
            newItems[existingIdx].quantity += quantity;
          } else {
            newItems.push({
              item_id: item.id,
              name: item.name,
              unit_price: item.price,
              quantity,
              modifiers
            });
          }

          const subtotal = newItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
          const tax = Math.round(subtotal * 0.1); // 10% for example
          const total = subtotal + tax;

          return {
            current_order: {
              ...state.current_order,
              items: newItems,
              subtotal,
              tax,
              total
            }
          };
        });
      },

      // Remove item from cart
      removeItem: (index) => {
        set((state) => {
          const newItems = state.current_order.items.filter((_, i) => i !== index);
          const subtotal = newItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
          const tax = Math.round(subtotal * 0.1);
          const total = subtotal + tax;

          return {
            current_order: {
              ...state.current_order,
              items: newItems,
              subtotal,
              tax,
              total
            }
          };
        });
      },

      // Complete sale (store locally, add to sync queue)
      completeSale: async (paymentMethod) => {
        const order = get().current_order;
        order.payment_method = paymentMethod;
        order.paid_at = new Date().toISOString();

        try {
          // Save to local IndexedDB
          await db.orders.add(order);
          await db.order_items.bulkAdd(
            order.items.map((item) => ({
              order_id: order.id,
              ...item
            }))
          );

          // Add to sync queue
          await db.sync_queue.add({
            id: generateUUID(),
            location_id: localStorage.getItem('location_id'),
            terminal_id: order.terminal_id,
            data: order,
            status: 'pending',
            created_at: new Date().toISOString()
          });

          // Reset for next order
          set({
            current_order: {
              id: generateUUID(),
              items: [],
              subtotal: 0,
              tax: 0,
              total: 0,
              payment_method: null,
              paid_at: null,
              terminal_id: localStorage.getItem('terminal_id'),
              staff_id: localStorage.getItem('staff_id'),
              sync_status: 'pending'
            }
          });

          return { success: true, order_id: order.id };
        } catch (error) {
          console.error('Failed to complete sale:', error);
          return { success: false, error: error.message };
        }
      },

      // Update item quantity
      updateQuantity: (index, quantity) => {
        set((state) => {
          const newItems = [...state.current_order.items];
          if (quantity <= 0) {
            newItems.splice(index, 1);
          } else {
            newItems[index].quantity = quantity;
          }

          const subtotal = newItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
          const tax = Math.round(subtotal * 0.1);
          const total = subtotal + tax;

          return {
            current_order: {
              ...state.current_order,
              items: newItems,
              subtotal,
              tax,
              total
            }
          };
        });
      },

      // Clear order (void)
      clearOrder: () => {
        set({
          current_order: {
            id: generateUUID(),
            items: [],
            subtotal: 0,
            tax: 0,
            total: 0,
            payment_method: null,
            paid_at: null,
            terminal_id: localStorage.getItem('terminal_id'),
            staff_id: localStorage.getItem('staff_id'),
            sync_status: 'pending'
          }
        });
      }
    }),
    { name: 'order-store' }
  )
);

// 3. SYNC ENGINE (db/sync.js)
// ============================================
export class SyncEngine {
  constructor(apiBaseUrl = 'http://localhost:3000/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.isOnline = navigator.onLine;
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  handleOnline() {
    console.log('📡 Online. Starting sync...');
    this.isOnline = true;
    this.syncAll();
  }

  handleOffline() {
    console.log('📡 Offline. Queue will sync when online.');
    this.isOnline = false;
  }

  async syncAll() {
    const pending = await db.sync_queue.where('status').equals('pending').toArray();

    for (const item of pending) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify(item.data)
        });

        if (response.ok) {
          // Mark as synced
          await db.sync_queue.update(item.id, {
            status: 'synced',
            updated_at: new Date().toISOString()
          });
          console.log(`✅ Synced order ${item.data.id}`);
        } else {
          throw new Error(`Server error: ${response.status}`);
        }
      } catch (error) {
        console.error(`❌ Sync failed for ${item.id}:`, error);
        await db.sync_queue.update(item.id, {
          attempt_count: item.attempt_count + 1,
          status: item.attempt_count >= 3 ? 'failed' : 'pending'
        });
      }

      // Debounce to avoid hammering server
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Periodic sync check (every 30s)
  startPeriodicSync(interval = 30000) {
    setInterval(() => {
      if (this.isOnline) {
        this.syncAll();
      }
    }, interval);
  }
}

// 4. POS CHECKOUT COMPONENT
// ============================================
import React, { useState, useEffect } from 'react';

export function POSCheckout() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const order = useOrderStore((state) => state.current_order);
  const addItem = useOrderStore((state) => state.addItem);
  const removeItem = useOrderStore((state) => state.removeItem);
  const updateQuantity = useOrderStore((state) => state.updateQuantity);
  const completeSale = useOrderStore((state) => state.completeSale);
  const clearOrder = useOrderStore((state) => state.clearOrder);

  useEffect(() => {
    loadCategories();
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadItems(selectedCategory);
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const cats = await db.categories.toArray();
      setCategories(cats);
      if (cats.length > 0) {
        setSelectedCategory(cats[0].id);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadItems = async (categoryId) => {
    try {
      const itemList = await db.items.where('category_id').equals(categoryId).toArray();
      setItems(itemList);
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  };

  const handleAddItem = (item) => {
    addItem(item);
  };

  const handlePayment = async (method) => {
    const result = await completeSale(method);
    if (result.success) {
      alert(`Order #${result.order_id} completed!`);
      // Print receipt (optional)
      printReceipt(result.order_id);
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const printReceipt = (orderId) => {
    // TODO: Implement receipt printing via thermal printer
    console.log('Printing receipt for order:', orderId);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left: Categories + Items */}
      <div className="flex-1 flex flex-col border-r">
        {/* Status bar */}
        <div className={`px-4 py-2 text-sm font-mono ${isOnline ? 'bg-green-100' : 'bg-yellow-100'}`}>
          {isOnline ? '🟢 Online' : '🔴 Offline'}
        </div>

        {/* Categories */}
        <div className="flex gap-1 p-2 border-b overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded text-sm whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleAddItem(item)}
                className="p-4 bg-gray-100 rounded-lg hover:bg-blue-100 text-center text-sm font-semibold"
              >
                {item.name}
                <div className="text-xs text-gray-600 mt-1">${(item.price / 100).toFixed(2)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart + Payment */}
      <div className="w-96 flex flex-col bg-gray-50 border-l">
        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-lg font-bold mb-3">Order</h2>
          {order.items.length === 0 ? (
            <p className="text-gray-400">No items</p>
          ) : (
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded">
                  <div>
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className="text-xs text-gray-500">
                      {item.quantity}x ${(item.unit_price / 100).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateQuantity(idx, item.quantity - 1)}
                      className="px-2 bg-gray-200 rounded text-sm"
                    >
                      −
                    </button>
                    <button
                      onClick={() => removeItem(idx)}
                      className="px-2 bg-red-200 rounded text-sm"
                    >
                      X
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t p-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>${(order.subtotal / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Tax (10%):</span>
            <span>${(order.tax / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total:</span>
            <span>${(order.total / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment buttons */}
        <div className="p-4 space-y-2">
          <button
            onClick={() => handlePayment('cash')}
            disabled={order.items.length === 0}
            className="w-full py-3 bg-green-500 text-white rounded font-bold text-lg hover:bg-green-600 disabled:opacity-50"
          >
            Cash (F1)
          </button>
          <button
            onClick={() => handlePayment('card')}
            disabled={order.items.length === 0}
            className="w-full py-3 bg-blue-500 text-white rounded font-bold text-lg hover:bg-blue-600 disabled:opacity-50"
          >
            Card (F2)
          </button>
          <button
            onClick={clearOrder}
            className="w-full py-3 bg-red-500 text-white rounded font-bold text-lg hover:bg-red-600"
          >
            Void (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

// 5. UTILITY FUNCTIONS
// ============================================
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default POSCheckout;
