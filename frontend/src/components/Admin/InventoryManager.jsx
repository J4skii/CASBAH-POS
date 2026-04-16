import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { formatZAR } from '../../lib/currency.js'
import api from '../../api/client.js'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function InventoryManager() {
  const { user }   = useAuthStore()
  const [inventory, setInventory] = useState([])
  const [adjusting, setAdjusting] = useState(null)  // { item, mode: 'set'|'adjust', value }
  const [saving,    setSaving]    = useState(false)
  const [search,    setSearch]    = useState('')

  useEffect(() => { loadInventory() }, [])

  async function loadInventory() {
    try {
      const { data } = await api.get(`/inventory/${user.location_id}`)
      setInventory(data)
    } catch (e) { console.error(e) }
  }

  async function saveAdjustment() {
    setSaving(true)
    try {
      const val = parseInt(adjusting.value)
      if (isNaN(val)) { alert('Enter a valid number'); return }
      const body = adjusting.mode === 'set'
        ? { quantity: val }
        : { adjustment: val }
      await api.patch(`/inventory/${adjusting.item.item_id}`, body)
      setAdjusting(null)
      loadInventory()
    } catch (e) {
      alert(e.response?.data?.error ?? 'Failed to update stock')
    } finally {
      setSaving(false)
    }
  }

  const filtered = inventory.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  const lowStock = filtered.filter((i) => i.quantity <= i.low_stock_alert)

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <button onClick={loadInventory} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
          ↻ Refresh
        </button>
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <div className="text-sm font-semibold text-amber-800 mb-1">Low stock alert</div>
          <div className="text-sm text-amber-700">
            {lowStock.map((i) => i.name).join(', ')}
          </div>
        </div>
      )}

      {/* Search */}
      <input
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-400"
        placeholder="Search items..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="bg-white rounded-xl border shadow-sm divide-y">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            {inventory.length === 0
              ? 'No tracked items yet. Enable stock tracking on items in Menu Management.'
              : 'No items match your search.'}
          </div>
        ) : filtered.map((item) => {
          const isLow = item.quantity <= item.low_stock_alert
          return (
            <div key={item.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{item.name}</div>
                <div className="text-xs text-gray-400">{formatZAR(item.price_cents)}</div>
              </div>

              {/* Stock badge */}
              <div className={`text-sm font-bold px-3 py-1 rounded-lg w-20 text-center ${
                item.quantity === 0
                  ? 'bg-red-100 text-red-700'
                  : isLow
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {item.quantity}
                <div className="text-xs font-normal opacity-70">in stock</div>
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <button
                  onClick={() => setAdjusting({ item, mode: 'adjust', value: '' })}
                  className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  title="Add or subtract stock"
                >
                  ± Adjust
                </button>
                <button
                  onClick={() => setAdjusting({ item, mode: 'set', value: String(item.quantity) })}
                  className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  title="Set exact stock count"
                >
                  Set
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Adjustment modal ── */}
      {adjusting && (
        <Modal
          title={adjusting.mode === 'set' ? `Set Stock — ${adjusting.item.name}` : `Adjust Stock — ${adjusting.item.name}`}
          onClose={() => setAdjusting(null)}
        >
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              Current stock: <span className="font-semibold text-gray-900">{adjusting.item.quantity}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {adjusting.mode === 'set' ? 'New stock count' : 'Adjustment (use − for removals, e.g. -5)'}
              </label>
              <input
                type="number"
                autoFocus
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:outline-none focus:border-brand-500"
                value={adjusting.value}
                onChange={(e) => setAdjusting({ ...adjusting, value: e.target.value })}
                placeholder={adjusting.mode === 'set' ? '0' : '+10 or -5'}
              />
            </div>

            {adjusting.mode === 'adjust' && adjusting.value && (
              <div className="text-sm text-center text-gray-600">
                New total:{' '}
                <span className="font-bold text-gray-900">
                  {adjusting.item.quantity + (parseInt(adjusting.value) || 0)}
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setAdjusting(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={saveAdjustment}
                disabled={adjusting.value === '' || saving}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
