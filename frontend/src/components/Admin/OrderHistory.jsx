import React, { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { formatZAR } from '../../lib/currency.js'
import { printReceipt } from '../shared/Receipt.jsx'
import api from '../../api/client.js'

const METHOD_LABEL = {
  cash:       'Cash',
  card_yoco:  'Card (Yoco)',
  snapscan:   'SnapScan',
  zapper:     'Zapper'
}

const STATUS_COLOURS = {
  paid:       'bg-green-100 text-green-800',
  preparing:  'bg-yellow-100 text-yellow-800',
  ready:      'bg-blue-100 text-blue-800',
  delivered:  'bg-gray-100 text-gray-600',
  voided:     'bg-red-100 text-red-700'
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' }) // YYYY-MM-DD
}

export default function OrderHistory() {
  const { user } = useAuthStore()
  const isManager = ['manager', 'owner'].includes(user.role)

  const [date,       setDate]       = useState(todayStr)
  const [orders,     setOrders]     = useState([])
  const [expanded,   setExpanded]   = useState(null)  // order id
  const [loading,    setLoading]    = useState(false)
  const [voidModal,  setVoidModal]  = useState(null)  // order to void
  const [voidReason, setVoidReason] = useState('')
  const [voiding,    setVoiding]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/orders/${user.location_id}?date=${date}&include_items=true`)
      setOrders(data)
    } catch (err) {
      console.error('OrderHistory: failed to load', err)
    } finally {
      setLoading(false)
    }
  }, [date, user.location_id])

  useEffect(() => { load() }, [load])

  async function handleVoid() {
    if (!voidModal || !voidReason.trim()) return
    setVoiding(true)
    try {
      await api.patch(`/orders/${voidModal.id}/status`, {
        status:      'voided',
        location_id: user.location_id,
        void_reason: voidReason.trim()
      })
      setVoidModal(null)
      setVoidReason('')
      await load()
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to void order')
    } finally {
      setVoiding(false)
    }
  }

  function handlePrint(order) {
    const location = JSON.parse(localStorage.getItem('mojatill_user') ?? '{}')
    printReceipt(order, {
      name:       location.location_name,
      vat_number: location.vat_number,
      address:    location.address,
      city:       location.city,
      phone:      location.phone
    })
  }

  // Daily totals
  const activeOrders = orders.filter((o) => o.status !== 'voided')
  const dailyTotal   = activeOrders.reduce((s, o) => s + (o.total_cents ?? 0), 0)
  const dailyCount   = activeOrders.length

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={load}
            className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg font-medium text-gray-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Daily summary */}
      {dailyCount > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm text-gray-500">Orders</div>
            <div className="text-3xl font-bold text-gray-900">{dailyCount}</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm text-gray-500">Revenue</div>
            <div className="text-3xl font-bold text-brand-700">{formatZAR(dailyTotal)}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-12 text-sm">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-400 py-16 text-sm">No orders for this date</div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const isExpanded = expanded === order.id
            const time = new Date(order.created_at).toLocaleTimeString('en-ZA', {
              hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'
            })
            const orderTypeLabel = { dine_in: 'Dine In', takeaway: 'Takeaway', collection: 'Collection' }[order.order_type] ?? ''

            return (
              <div key={order.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Order header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                >
                  <div className="font-bold text-gray-900 w-14 text-sm">#{order.order_number}</div>
                  <div className="text-xs text-gray-500 w-12">{time}</div>
                  <div className="flex-1 text-sm text-gray-700 truncate">
                    {order.staff_name}
                    {orderTypeLabel && <span className="ml-2 text-xs text-gray-400">{orderTypeLabel}</span>}
                  </div>
                  <div className="text-xs text-gray-500">{METHOD_LABEL[order.payment_method] ?? order.payment_method}</div>
                  <div className="font-semibold text-brand-700 text-sm w-24 text-right">{formatZAR(order.total_cents)}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {order.status}
                  </span>
                  <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 px-4 py-3">
                    {/* Line items */}
                    <table className="w-full text-sm mb-3">
                      <tbody>
                        {(order.items ?? []).map((item, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1 text-gray-700">
                              {item.quantity} × {item.name ?? item.item_name}
                            </td>
                            <td className="py-1 text-right text-gray-900 font-medium">
                              {formatZAR((item.unit_price_cents ?? 0) * item.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Totals */}
                    <div className="text-sm space-y-0.5 mb-3">
                      {(order.discount_cents ?? 0) > 0 && (
                        <div className="flex justify-between text-red-700">
                          <span>Discount{order.discount_note ? ` (${order.discount_note})` : ''}</span>
                          <span>-{formatZAR(order.discount_cents)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-gray-900">
                        <span>Total</span>
                        <span>{formatZAR(order.total_cents)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>VAT (15% incl.)</span>
                        <span>{formatZAR(order.vat_cents)}</span>
                      </div>
                      {order.cash_tendered_cents && (
                        <div className="flex justify-between text-gray-600">
                          <span>Cash Tendered / Change</span>
                          <span>{formatZAR(order.cash_tendered_cents)} / {formatZAR(order.change_cents ?? 0)}</span>
                        </div>
                      )}
                    </div>

                    {order.notes && (
                      <div className="text-xs text-gray-500 mb-3 italic">Notes: {order.notes}</div>
                    )}
                    {order.void_reason && (
                      <div className="text-xs text-red-600 mb-3">Void reason: {order.void_reason}</div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePrint(order)}
                        className="text-xs px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-gray-700"
                      >
                        Print Receipt
                      </button>
                      {isManager && order.status !== 'voided' && (
                        <button
                          onClick={() => { setVoidModal(order); setVoidReason('') }}
                          className="text-xs px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded-lg font-medium text-red-700"
                        >
                          Void Order
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Void confirmation modal */}
      {voidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Void Order #{voidModal.order_number}</h3>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone. Please provide a reason.</p>
            <input
              autoFocus
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setVoidModal(null); setVoidReason('') }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim() || voiding}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {voiding ? 'Voiding...' : 'Void Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
