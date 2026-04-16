import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { formatZAR, randsToCents, centsToRands } from '../../lib/currency.js'
import api from '../../api/client.js'

const COLOURS = ['#10B981','#3B82F6','#EF4444','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316']

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function MenuManager() {
  const { user } = useAuthStore()
  const [categories,  setCategories]  = useState([])
  const [items,       setItems]       = useState([])
  const [selectedCat, setSelectedCat] = useState(null)
  const [catForm,     setCatForm]     = useState(null)   // null | category object (id=edit, no id=new)
  const [itemForm,    setItemForm]    = useState(null)   // null | item object
  const [saving,      setSaving]      = useState(false)

  useEffect(() => { loadCategories() }, [])
  useEffect(() => { if (selectedCat) loadItems(selectedCat) }, [selectedCat])

  async function loadCategories() {
    try {
      const { data } = await api.get(`/categories/${user.location_id}`)
      setCategories(data)
      if (data.length > 0 && !selectedCat) setSelectedCat(data[0].id)
    } catch (e) { console.error(e) }
  }

  async function loadItems(catId) {
    try {
      const { data } = await api.get(`/items/${user.location_id}/${catId}`)
      setItems(data)
    } catch (e) { console.error(e) }
  }

  async function saveCategory() {
    setSaving(true)
    try {
      catForm.id
        ? await api.patch(`/categories/${catForm.id}`, catForm)
        : await api.post('/categories', catForm)
      setCatForm(null)
      await loadCategories()
    } catch (e) { alert(e.response?.data?.error ?? 'Failed to save category') }
    finally { setSaving(false) }
  }

  async function toggleCategory(cat) {
    try {
      await api.patch(`/categories/${cat.id}`, { active: !cat.active })
      loadCategories()
    } catch (e) { console.error(e) }
  }

  async function saveItem() {
    setSaving(true)
    try {
      const price_cents = randsToCents(itemForm.price_rands)
      if (itemForm.id) {
        await api.patch(`/items/${itemForm.id}`, { ...itemForm, price_cents })
      } else {
        await api.post('/items', { ...itemForm, category_id: selectedCat, price_cents })
      }
      setItemForm(null)
      await loadItems(selectedCat)
    } catch (e) { alert(e.response?.data?.error ?? 'Failed to save item') }
    finally { setSaving(false) }
  }

  async function toggleItem(item) {
    try {
      await api.patch(`/items/${item.id}`, { active: !item.active })
      loadItems(selectedCat)
    } catch (e) { console.error(e) }
  }

  async function toggleInventory(item) {
    try {
      await api.post(`/items/${item.id}/toggle-inventory`)
      loadItems(selectedCat)
    } catch (e) { console.error(e) }
  }

  const selectedCatObj = categories.find((c) => c.id === selectedCat)

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Menu Management</h1>

      <div className="flex gap-6">
        {/* ── Categories sidebar ── */}
        <div className="w-56 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Categories</span>
            <button
              onClick={() => setCatForm({ name: '', colour: '#10B981' })}
              className="text-xs bg-brand-600 text-white px-2 py-1 rounded-lg hover:bg-brand-700"
            >
              + Add
            </button>
          </div>
          <div className="space-y-1">
            {categories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group ${
                  selectedCat === cat.id ? 'bg-brand-100 border border-brand-300' : 'hover:bg-gray-100'
                }`}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.colour }} />
                <span className={`text-sm flex-1 truncate ${!cat.active ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {cat.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setCatForm({ ...cat }) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✎
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Items panel ── */}
        <div className="flex-1">
          {selectedCatObj && (
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">{selectedCatObj.name}</h2>
              <button
                onClick={() => setItemForm({ name: '', description: '', price_rands: '', sort_order: 0, track_inventory: false })}
                className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700"
              >
                + Add Item
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border shadow-sm divide-y">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                No items yet — click "+ Add Item" to start
              </div>
            ) : items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm ${!item.active ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {item.name}
                  </div>
                  {item.description && (
                    <div className="text-xs text-gray-400 truncate">{item.description}</div>
                  )}
                </div>
                <div className="text-sm font-semibold text-brand-700 w-24 text-right">
                  {formatZAR(item.price_cents)}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  {item.track_inventory ? (
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      Stock: {item.current_stock ?? 0}
                    </span>
                  ) : (
                    <button
                      onClick={() => toggleInventory(item)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded"
                      title="Enable stock tracking"
                    >
                      + Track
                    </button>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setItemForm({ ...item, price_rands: centsToRands(item.price_cents) })}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleItem(item)}
                    className={`text-xs px-2 py-1 rounded ${item.active ? 'bg-red-100 hover:bg-red-200 text-red-700' : 'bg-green-100 hover:bg-green-200 text-green-700'}`}
                  >
                    {item.active ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Category modal ── */}
      {catForm && (
        <Modal title={catForm.id ? 'Edit Category' : 'New Category'} onClose={() => setCatForm(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Colour</label>
              <div className="flex gap-2 flex-wrap">
                {COLOURS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCatForm({ ...catForm, colour: c })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${catForm.colour === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            {catForm.id && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cat-active"
                  checked={catForm.active ?? true}
                  onChange={(e) => setCatForm({ ...catForm, active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="cat-active" className="text-sm text-gray-700">Active (visible on POS)</label>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setCatForm(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={saveCategory} disabled={!catForm.name || saving} className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Item modal ── */}
      {itemForm && (
        <Modal title={itemForm.id ? 'Edit Item' : 'New Item'} onClose={() => setItemForm(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={itemForm.description ?? ''}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (R) — VAT inclusive</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 font-medium">R</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={itemForm.price_rands}
                  onChange={(e) => setItemForm({ ...itemForm, price_rands: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort order</label>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={itemForm.sort_order ?? 0}
                onChange={(e) => setItemForm({ ...itemForm, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="track-inv"
                checked={itemForm.track_inventory ?? false}
                onChange={(e) => setItemForm({ ...itemForm, track_inventory: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="track-inv" className="text-sm text-gray-700">Track inventory (stock count)</label>
            </div>
            {itemForm.id && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="item-active"
                  checked={itemForm.active ?? true}
                  onChange={(e) => setItemForm({ ...itemForm, active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="item-active" className="text-sm text-gray-700">Active (visible on POS)</label>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setItemForm(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={saveItem} disabled={!itemForm.name || !itemForm.price_rands || saving} className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
