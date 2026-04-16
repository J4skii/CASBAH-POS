import React, { useState } from 'react'
import { formatZAR } from '../../lib/currency.js'

/**
 * Shown when an item has modifiers_template.
 * @param {object} item        - menu item with modifiers_template
 * @param {function} onConfirm - called with { modifiers, addon_cents }
 * @param {function} onClose
 */
export default function ModifiersModal({ item, onConfirm, onClose }) {
  // selections: { groupName: Set<optionName> }
  const [selections, setSelections] = useState(() => {
    const init = {}
    for (const g of (item.modifiers_template ?? [])) {
      init[g.name] = new Set()
    }
    return init
  })

  const groups = item.modifiers_template ?? []

  function toggle(group, optName) {
    setSelections((prev) => {
      const next = { ...prev }
      const sel  = new Set(next[group.name])
      if (group.multi_select) {
        sel.has(optName) ? sel.delete(optName) : sel.add(optName)
      } else {
        // radio behaviour — replace selection
        sel.clear()
        sel.add(optName)
      }
      next[group.name] = sel
      return next
    })
  }

  function isValid() {
    return groups.every((g) => !g.required || selections[g.name]?.size > 0)
  }

  function totalAddon() {
    let cents = 0
    for (const g of groups) {
      const sel = selections[g.name]
      if (!sel) continue
      for (const optName of sel) {
        const opt = g.options?.find((o) => o.name === optName)
        if (opt) cents += opt.price_addon_cents ?? 0
      }
    }
    return cents
  }

  function handleConfirm() {
    if (!isValid()) return
    const modifiers = {}
    for (const [gName, sel] of Object.entries(selections)) {
      if (sel.size > 0) modifiers[gName] = [...sel]
    }
    onConfirm({ modifiers, addon_cents: totalAddon() })
  }

  const addon = totalAddon()
  const finalPrice = item.price_cents + addon

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{item.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">Customise your order</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl mt-0.5">✕</button>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {groups.map((group) => (
            <div key={group.name}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-sm text-gray-800">{group.name}</span>
                {group.required && (
                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Required</span>
                )}
                {group.multi_select && (
                  <span className="text-xs text-gray-400">Select all that apply</span>
                )}
              </div>
              <div className="space-y-1">
                {(group.options ?? []).map((opt) => {
                  const selected = selections[group.name]?.has(opt.name)
                  return (
                    <button
                      key={opt.name}
                      onClick={() => toggle(group, opt.name)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-colors text-left ${
                        selected
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selected ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                        }`}>
                          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{opt.name}</span>
                      </div>
                      {(opt.price_addon_cents ?? 0) > 0 && (
                        <span className="text-sm text-brand-700 font-semibold">
                          +{formatZAR(opt.price_addon_cents)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">Item total</span>
            <span className="font-bold text-lg text-brand-700">{formatZAR(finalPrice)}</span>
          </div>
          <button
            onClick={handleConfirm}
            disabled={!isValid()}
            className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold text-base hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  )
}
