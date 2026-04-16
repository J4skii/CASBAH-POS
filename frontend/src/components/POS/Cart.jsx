import React from 'react'
import { useOrderStore } from '../../store/orderStore.js'
import { formatZAR } from '../../lib/currency.js'

export default function Cart({ onPay }) {
  const { current_order, removeItem, updateQuantity, clearOrder, setNotes } = useOrderStore()
  const { items, subtotal_cents, vat_cents, total_cents, notes } = current_order
  const hasItems = items.length > 0

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

      {/* Totals */}
      <div className="border-t bg-gray-50 px-4 py-3 space-y-1 flex-shrink-0">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatZAR(subtotal_cents)}</span>
        </div>
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
