import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { formatZAR } from '../../lib/currency.js'
import api from '../../api/client.js'

export default function Dashboard() {
  const { user }     = useAuthStore()
  const [today,      setToday]     = useState(null)
  const [topItems,   setTopItems]  = useState([])
  const [hourly,     setHourly]    = useState([])
  const [loading,    setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/reports/today/${user.location_id}`),
      api.get(`/reports/top-items/${user.location_id}`),
      api.get(`/reports/hourly/${user.location_id}`)
    ])
      .then(([t, items, h]) => {
        setToday(t.data)
        setTopItems(items.data)
        setHourly(h.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-8 text-gray-400 text-sm">Loading dashboard...</div>
  }

  const paymentBreakdown = today ? [
    { label: 'Cash',     value: today.cash_cents,     colour: 'bg-green-500' },
    { label: 'Yoco',     value: today.yoco_cents,     colour: 'bg-blue-500'  },
    { label: 'SnapScan', value: today.snapscan_cents, colour: 'bg-red-500'   },
    { label: 'Zapper',   value: today.zapper_cents,   colour: 'bg-purple-500'},
  ].filter((p) => p.value > 0) : []

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {user.location_name ?? 'Dashboard'} — Today
      </h1>

      {/* KPI cards */}
      {today && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Sales',  value: formatZAR(today.total_cents)     },
            { label: 'Orders',       value: today.order_count                },
            { label: 'Avg Order',    value: formatZAR(today.avg_order_cents) },
            { label: 'VAT Collected',value: formatZAR(today.vat_cents)       }
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Payment breakdown */}
      {paymentBreakdown.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment Methods</h2>
          <div className="flex gap-3 flex-wrap">
            {paymentBreakdown.map((p) => (
              <div key={p.label} className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded-full ${p.colour}`} />
                <span className="text-gray-600">{p.label}:</span>
                <span className="font-semibold">{formatZAR(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top items */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-900">Top Items — Last 7 Days</h2>
          </div>
          <div className="divide-y">
            {topItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No sales data yet</div>
            ) : topItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium text-sm text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400">{item.total_sold} sold</div>
                </div>
                <div className="font-semibold text-brand-700 text-sm">{formatZAR(item.total_revenue_cents)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly breakdown */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-900">Hourly Sales — Today</h2>
          </div>
          <div className="divide-y">
            {hourly.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No sales yet today</div>
            ) : hourly.map((h) => (
              <div key={h.hour} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-gray-500 font-mono">
                  {String(h.hour).padStart(2, '0')}:00
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{h.order_count} orders</span>
                  <span className="font-semibold text-gray-900">{formatZAR(h.total_cents)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
