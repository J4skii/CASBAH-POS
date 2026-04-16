import React, { useState, useEffect } from 'react'

export default function OrderCard({ order, onReady }) {
  const [elapsed, setElapsed] = useState(
    Math.floor((Date.now() - new Date(order.created_at)) / 1000)
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(order.created_at)) / 1000))
    }, 1_000)
    return () => clearInterval(interval)
  }, [order.created_at])

  const minutes  = Math.floor(elapsed / 60)
  const seconds  = elapsed % 60
  const isUrgent = elapsed > 600  // red after 10 minutes

  return (
    <div
      className={`rounded-xl p-4 flex flex-col gap-3 border ${
        isUrgent
          ? 'bg-red-900/80 border-red-500'
          : 'bg-gray-800 border-gray-700'
      }`}
    >
      {/* Order number + timer */}
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-white">#{order.order_number}</span>
        <span className={`text-sm font-mono ${isUrgent ? 'text-red-300' : 'text-gray-400'}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>

      {/* Line items */}
      <div className="space-y-1 flex-1 min-h-[60px]">
        {order.items?.length > 0 ? (
          order.items.map((item, i) => (
            <div key={i} className="text-sm text-gray-300">
              <span className="text-white font-semibold">{item.quantity}×</span> {item.name}
              {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                <div className="text-xs text-gray-500 ml-4">
                  {Object.entries(item.modifiers).map(([k, v]) => `${k}: ${v}`).join(', ')}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-xs text-gray-500 italic">Items loading...</div>
        )}
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="text-xs text-amber-300 bg-amber-900/30 rounded-lg p-2">
          📝 {order.notes}
        </div>
      )}

      {/* Ready button */}
      <button
        onClick={onReady}
        className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold text-sm transition-colors active:scale-95"
      >
        Ready ✓
      </button>
    </div>
  )
}
