import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { formatZAR, randsToCents, centsToRands } from '../../lib/currency.js'
import api from '../../api/client.js'

const COLOURS = ['#10B981','#3B82F6','#EF4444','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316']

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl p-6 w-full shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Modifier template editor ──────────────────────────────────────────────────
function ModifierEditor({ template, onChange }) {
  function addGroup() {
    onChange([...template, { name: '', required: false, multi_select: false, options: [] }])
  }

  function removeGroup(gi) {
    onChange(template.filter((_, i) => i !== gi))
  }

  function updateGroup(gi, patch) {
    onChange(template.map((g, i) => i === gi ? { ...g, ...patch } : g))
  }

  function addOption(gi) {
    const groups = template.map((g, i) =>
      i === gi ? { ...g, options: [...g.options, { name: '', price_addon_cents: 0 }] } : g
    )
    onChange(groups)
  }

  function removeOption(gi, oi) {
    const groups = template.map((g, i) =>
      i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g
    )
    onChange(groups)
  }

  function updateOption(gi, oi, patch) {
    const groups = template.map((g, i) =>
      i === gi
        ? { ...g, options: g.options.map((o, j) => j === oi ? { ...o, ...patch } : o) }
        : g
    )
    onChange(groups)
  }

  return (
    <div className="space-y-4">
      {template.map((group, gi) => (
        <div key={gi} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Group name (e.g. Size, Extras)"
              value={group.name}
              onChange={(e) => updateGroup(gi, { name: e.target.value })}
            />
            <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
              <input type="checkbox" checked={group.required} onChange={(e) => updateGroup(gi, { required: e.target.checked })} />
              Required
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
              <input type="checkbox" checked={group.multi_select} onChange={(e) => updateGroup(gi, { multi_select: e.target.checked })} />
              Multi
            </label>
            <button onClick={() => removeGroup(gi)} className="text-red-400 hover:text-red-600 text-sm font-bold">✕</button>
          </div>

          <div className="space-y-2">
            {group.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                  placeholder="Option name"
                  value={opt.name}
                  onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                />
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-gray-500 text-sm">R</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-24 border border-gray-300 rounded-lg pl-6 pr-2 py-1.5 text-sm focus:outline-none"
                    placeholder="0.00"
                    value={opt.price_addon_cents > 0 ? centsToRands(opt.price_addon_cents) : ''}
                    onChange={(e) => updateOption(gi, oi, { price_addon_cents: randsToCents(e.target.value || '0') })}
                  />
                </div>
                <button onClick={() => removeOption(gi, oi)} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
              </div>
            ))}
          </div>
          <button
            onClick={() => addOption(gi)}
            className="mt-2 text-xs text-brand-600 hover:text-brand-800 font-medium"
          >
            + Add option
          </button>
        </div>
      ))}
      <button
        onClick={addGroup}
        className="text-sm text-brand-600 hover:text-brand-800 font-medium"
      >
        + Add modifier group
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MenuManager() {
  const { user } = useAuthStore()
  const [categories,     setCategories]     = useState([])
  const [items,          setItems]          = useState([])
  const [selectedCat,    setSelectedCat]    = useState(null)
  const [catForm,        setCatForm]        = useState(null)
  const [itemForm,       setItemForm]       = useState(null)
  const [showModifiers,  setShowModifiers]  = useState(false)
  const [saving,         setSaving]         = useState(false)

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
        : await api.post('/categories', { ...catForm, location_id: user.location_id })
      setCatForm(null)
      await loadCategories()
    } catch (e) { alert(e.response?.data?.error ?? 'Failed to save category') }
    finally { setSaving(false) }
  }

  async function saveItem() {
    setSaving(true)
    try {
      const price_cents = randsToCents(itemForm.price_rands)
      const payload = {
        ...itemForm,
        price_cents,
        modifiers_template: itemForm.modifiers_template ?? []
      }
      if (itemForm.id) {
        await api.patch(`/items/${itemForm.id}`, payload)
      } else {
        await api.post('/items', { ...payload, category_id: selectedCat })
      }
      setItemForm(null)
      setShowModifiers(false)
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
                onClick={() => {
                  setItemForm({ name: '', description: '', price_rands: '', sort_order: 0, track_inventory: false, modifiers_template: [] })
                  setShowModifiers(false)
                }}
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
                  {(item.modifiers_template?.length > 0) && (
                    <div className="text-xs text-brand-600">{item.modifiers_template.length} modifier group{item.modifiers_template.length > 1 ? 's' : ''}</div>
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
                    onClick={() => {
                      setItemForm({ ...item, price_rands: centsToRands(item.price_cents), modifiers_template: item.modifiers_template ?? [] })
                      setShowModifiers(false)
                    }}
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
        <Modal title={itemForm.id ? 'Edit Item' : 'New Item'} onClose={() => { setItemForm(null); setShowModifiers(false) }} wide={showModifiers}>
          {!showModifiers ? (
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
              <button
                type="button"
                onClick={() => setShowModifiers(true)}
                className="w-full py-2 border border-dashed border-brand-400 text-brand-600 rounded-lg text-sm hover:bg-brand-50 font-medium"
              >
                {(itemForm.modifiers_template?.length > 0)
                  ? `Edit Modifiers (${itemForm.modifiers_template.length} group${itemForm.modifiers_template.length > 1 ? 's' : ''})`
                  : '+ Add Modifiers (optional)'
                }
              </button>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setItemForm(null) }} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={saveItem} disabled={!itemForm.name || !itemForm.price_rands || saving} className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setShowModifiers(false)} className="text-sm text-brand-600 hover:text-brand-800">
                  ← Back to item
                </button>
                <span className="text-sm text-gray-500">/ Modifiers for "{itemForm.name}"</span>
              </div>
              <ModifierEditor
                template={itemForm.modifiers_template ?? []}
                onChange={(t) => setItemForm({ ...itemForm, modifiers_template: t })}
              />
              <div className="flex gap-3 mt-4 pt-4 border-t">
                <button onClick={() => setShowModifiers(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Back</button>
                <button onClick={saveItem} disabled={saving} className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
