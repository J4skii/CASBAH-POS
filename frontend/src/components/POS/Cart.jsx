import React, { useState } from 'react'
import { useOrderStore } from '../../store/orderStore.js'
import { formatZAR } from '../../lib/currency.js'

const ORDER_TYPES = [
  { id: 'dine_in',    label: 'Dine In' },
  { id: 'takeaway',   label: 'Takeaway' },
  { id: 'collection', label: 'Collection' }
]

export default function Cart({ onPay }) {
  const {
    current_order,
    removeItem, updateQuantity, clearOrder, setNotes,
    setOrderType, applyDiscount, clearDiscount, setDiscountNote
  } = useOrderStore()
  const { items, subtotal_cents, vat_cents, total_cents, discount_cents, discount_note, order_type, notes } = current_order
  const hasItems = items.length > 0

  const [discountType,  setDiscountType]  = useState('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [showDiscount,  setShowDiscount]  = useState(false)

  function handleApplyDiscount() {
    const val = parseFloat(discountValue)
    if (isNaN(val) || val <= 0) return
    applyDiscount(discountType, val)
    if (discount_note === '') setDiscountNote('')
    setShowDiscount(false)
    setDiscountValue('')
  }

  function handleClearDiscount() {
    clearDiscount()
    setDiscountValue('')
    setShowDiscount(false)
  }

  return (
    <div className="w-96 flex flex-col bg-white border-l shadow-lg flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 flex-shrink-0">
        <h2 className="font-bold text-lg text-gray-900">Order</h2>
        {hasItems && (
          <button
            onClick={clearOrder}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Void order
          </button>
        )}
      </div>

      {/* Order type selector */}
      <div className="flex border-b flex-shrink-0">
        {ORDER_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setOrderType(t.id)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              order_type === t.id
                ? 'bg-brand-600 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 pb-8">
            <span className="text-4xl">🛒</span>
            <span className="text-sm">Tap items to add</span>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{item.name}</div>
                  <div className="text-xs text-gray-500">{formatZAR(item.unit_price_cents)} each</div>
                  {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                    <div className="text-xs text-brand-600 truncate">
                      {Object.entries(item.modifiers).map(([g, opts]) =>
                        `${g}: ${Array.isArray(opts) ? opts.join(', ') : opts}`
                      ).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(idx, item.quantity - 1)}
                    className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(idx, item.quantity + 1)}
                    className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeItem(idx)}
                    className="w-7 h-7 rounded bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold ml-1 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-sm font-semibold text-gray-900 w-20 text-right">
                  {formatZAR(item.unit_price_cents * item.quantity)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {hasItems && (
        <div className="px-4 py-2 border-t">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Order notes (optional)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
      )}

      {/* Discount section */}
      {hasItems && (
        <div className="px-4 py-2 border-t">
          {discount_cents > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-700">Discount applied: -{formatZAR(discount_cents)}</span>
                <input
                  type="text"
                  value={discount_note}
                  onChange={(e) => setDiscountNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="text-xs border border-gray-200 rounded px-2 py-1 w-28 focus:outline-none"
                />
              </div>
              <button
                onClick={handleClearDiscount}
                className="text-xs text-gray-400 hover:text-red-500 font-medium"
              >
                Remove
              </button>
            </div>
          ) : showDiscount ? (
            <div className="flex items-center gap-1">
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                <button
                  onClick={() => setDiscountType('percent')}
                  className={`px-2 py-1.5 font-medium ${discountType === 'percent' ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  %
                </button>
                <button
                  onClick={() => setDiscountType('fixed')}
                  className={`px-2 py-1.5 font-medium ${discountType === 'fixed' ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  R
                </button>
              </div>
              <input
                type="number"
                min="0"
                step={discountType === 'percent' ? '1' : '0.01'}
                max={discountType === 'percent' ? '100' : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? '10' : '5.00'}
                className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
              />
              <button
                onClick={handleApplyDiscount}
                disabled={!discountValue}
                className="text-xs bg-brand-600 text-white px-2 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
              >
                Apply
              </button>
              <button onClick={() => { setShowDiscount(false); setDiscountValue('') }} className="text-xs text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDiscount(true)}
              className="text-xs text-brand-600 hover:text-brand-800 font-medium"
            >
              + Add discount
            </button>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="border-t bg-gray-50 px-4 py-3 space-y-1 flex-shrink-0">
        {discount_cents > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatZAR(subtotal_cents)}</span>
          </div>
        )}
        {discount_cents > 0 && (
          <div className="flex justify-between text-sm text-red-700 font-medium">
            <span>Discount</span>
            <span>-{formatZAR(discount_cents)}</span>
          </div>
        )}
        {discount_cents === 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatZAR(subtotal_cents)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs text-gray-400">
          <span>VAT (15% incl.)</span>
          <span>{formatZAR(vat_cents)}</span>
        </div>
        <div className="flex justify-between text-xl font-bold text-gray-900 pt-1 border-t mt-1">
          <span>Total</span>
          <span className="text-brand-700">{formatZAR(total_cents)}</span>
        </div>
      </div>

      {/* Pay button */}
      <div className="p-4 flex-shrink-0">
        <button
          onClick={onPay}
          disabled={!hasItems}
          className="w-full py-4 bg-brand-600 text-white rounded-xl text-xl font-bold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
        >
          {hasItems ? `Pay ${formatZAR(total_cents)}` : 'Pay'}
        </button>
      </div>
    </div>
  )
}
