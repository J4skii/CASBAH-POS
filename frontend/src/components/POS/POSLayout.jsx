import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { syncEngine } from '../../db/sync.js'
import ItemSelector from './ItemSelector.jsx'
import Cart from './Cart.jsx'
import PaymentModal from './PaymentModal.jsx'
import Dashboard from '../Admin/Dashboard.jsx'
import SyncStatus from '../shared/SyncStatus.jsx'

export default function POSLayout() {
  const { user, logout } = useAuthStore()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [view,        setView]        = useState('pos') // 'pos' | 'dashboard'

  const isManager = ['manager', 'owner'].includes(user.role)

  useEffect(() => {
    syncEngine.startPeriodicSync()
    return () => syncEngine.stopPeriodicSync()
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-100 no-select">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="bg-brand-700 text-white px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg">MojaTill</span>
          {isManager && (
            <div className="flex gap-1 text-sm">
              <button
                onClick={() => setView('pos')}
                className={`px-3 py-1 rounded transition-colors ${view === 'pos' ? 'bg-brand-500' : 'hover:bg-brand-600'}`}
              >
                Till
              </button>
              <button
                onClick={() => setView('dashboard')}
                className={`px-3 py-1 rounded transition-colors ${view === 'dashboard' ? 'bg-brand-500' : 'hover:bg-brand-600'}`}
              >
                Dashboard
              </button>
            </div>
          )}
        </div>

        <SyncStatus />

        <div className="flex items-center gap-3 text-sm">
          <span className="opacity-70">{user.username}</span>
          <button
            onClick={logout}
            className="bg-brand-800 hover:bg-brand-900 px-3 py-1 rounded text-xs transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      {view === 'pos' ? (
        <div className="flex flex-1 overflow-hidden">
          <ItemSelector />
          <Cart onPay={() => setPaymentOpen(true)} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <Dashboard />
        </div>
      )}

      {paymentOpen && <PaymentModal onClose={() => setPaymentOpen(false)} />}
    </div>
  )
}
