import React, { useState, useEffect } from 'react'
import { db } from '../../db/schema.js'
import { useOrderStore } from '../../store/orderStore.js'
import { formatZAR } from '../../lib/currency.js'
import ModifiersModal from './ModifiersModal.jsx'
import api from '../../api/client.js'

export default function ItemSelector() {
  const [categories,    setCategories]    = useState([])
  const [items,         setItems]         = useState([])
  const [selectedCat,   setSelectedCat]   = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [modifierItem,  setModifierItem]  = useState(null)  // item awaiting modifier selection

  const addItem    = useOrderStore((s) => s.addItem)
  const { location_id } = JSON.parse(localStorage.getItem('mojatill_user') ?? '{}')

  useEffect(() => { loadCategories() }, [])
  useEffect(() => { if (selectedCat) loadItems(selectedCat) }, [selectedCat])

  async function loadCategories() {
    try {
      const { data } = await api.get(`/categories/${location_id}`)
      await db.categories.bulkPut(data)
      setCategories(data)
      if (data.length > 0) setSelectedCat(data[0].id)
    } catch {
      const local = await db.categories.toArray()
      setCategories(local)
      if (local.length > 0) setSelectedCat(local[0].id)
    } finally {
      setLoading(false)
    }
  }

  async function loadItems(categoryId) {
    try {
      const { data } = await api.get(`/items/${location_id}/${categoryId}`)
      await db.items.bulkPut(data)
      setItems(data)
    } catch {
      const local = await db.items.where('category_id').equals(categoryId).toArray()
      setItems(local)
    }
  }

  function handleItemTap(item) {
    if (item.modifiers_template?.length > 0) {
      setModifierItem(item)
    } else {
      addItem(item)
    }
  }

  function handleModifierConfirm({ modifiers, addon_cents }) {
    const itemWithAddon = {
      ...modifierItem,
      price_cents: modifierItem.price_cents + addon_cents
    }
    addItem(itemWithAddon, 1, modifiers)
    setModifierItem(null)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Loading menu...
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Category tabs */}
      <div className="flex gap-1 p-2 border-b overflow-x-auto flex-shrink-0 bg-gray-50">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            style={selectedCat === cat.id ? { backgroundColor: cat.colour ?? '#059669' } : {}}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              selectedCat === cat.id
                ? 'text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 text-sm mt-12">No items in this category</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => {
              const outOfStock = item.track_inventory && item.current_stock === 0
              const lowStock   = item.track_inventory && item.current_stock > 0 && item.current_stock <= (item.low_stock_alert ?? 5)
              const hasModifiers = item.modifiers_template?.length > 0

              return (
                <button
                  key={item.id}
                  onClick={() => !outOfStock && handleItemTap(item)}
                  disabled={outOfStock}
                  className={`p-4 rounded-xl text-left transition-all active:scale-95 border ${
                    outOfStock
                      ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white hover:bg-brand-50 hover:border-brand-300 border-gray-200 shadow-sm'
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-900 leading-tight">{item.name}</div>
                  <div className="text-brand-700 font-bold text-base mt-1">{formatZAR(item.price_cents)}</div>
                  {outOfStock   && <div className="text-xs text-red-400 mt-1">Out of stock</div>}
                  {lowStock     && <div className="text-xs text-amber-500 mt-1">{item.current_stock} left</div>}
                  {hasModifiers && !outOfStock && <div className="text-xs text-gray-400 mt-1">Customisable</div>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Modifiers modal */}
      {modifierItem && (
        <ModifiersModal
          item={modifierItem}
          onConfirm={handleModifierConfirm}
          onClose={() => setModifierItem(null)}
        />
      )}
    </div>
  )
}
