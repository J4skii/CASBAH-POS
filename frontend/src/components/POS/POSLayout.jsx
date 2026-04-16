import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { syncEngine } from '../../db/sync.js'
import ItemSelector from './ItemSelector.jsx'
import Cart from './Cart.jsx'
import PaymentModal from './PaymentModal.jsx'
import Dashboard from '../Admin/Dashboard.jsx'
import MenuManager from '../Admin/MenuManager.jsx'
import InventoryManager from '../Admin/InventoryManager.jsx'
import StaffManager from '../Admin/StaffManager.jsx'
import LocationSettings from '../Admin/LocationSettings.jsx'
import SyncStatus from '../shared/SyncStatus.jsx'

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard', roles: ['manager', 'owner'] },
  { id: 'menu',      label: 'Menu',      roles: ['manager', 'owner'] },
  { id: 'inventory', label: 'Inventory', roles: ['manager', 'owner'] },
  { id: 'staff',     label: 'Staff',     roles: ['manager', 'owner'] },
  { id: 'settings',  label: 'Settings',  roles: ['owner'] }
]

export default function POSLayout() {
  const { user, logout } = useAuthStore()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [view,        setView]        = useState('pos')

  const visibleTabs = ADMIN_TABS.filter((t) => t.roles.includes(user.role))

  useEffect(() => {
    syncEngine.startPeriodicSync()
    return () => syncEngine.stopPeriodicSync()
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-100 no-select">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="bg-brand-700 text-white px-4 py-0 flex items-center justify-between flex-shrink-0 h-12">
        {/* Left: logo + nav tabs */}
        <div className="flex items-center gap-1 h-full">
          <span className="font-bold text-base mr-3">MojaTill</span>

          {/* Till tab — always visible */}
          <NavTab active={view === 'pos'} onClick={() => setView('pos')}>
            Till
          </NavTab>

          {/* Admin tabs */}
          {visibleTabs.map((tab) => (
            <NavTab key={tab.id} active={view === tab.id} onClick={() => setView(tab.id)}>
              {tab.label}
            </NavTab>
          ))}
        </div>

        {/* Right: sync + user */}
        <div className="flex items-center gap-4">
          <SyncStatus />
          <div className="flex items-center gap-2 text-sm">
            <span className="opacity-70 text-xs">{user.username}</span>
            <button
              onClick={logout}
              className="bg-brand-800 hover:bg-brand-900 px-2 py-1 rounded text-xs transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────── */}
      {view === 'pos' ? (
        <div className="flex flex-1 overflow-hidden">
          <ItemSelector />
          <Cart onPay={() => setPaymentOpen(true)} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-gray-50">
          {view === 'dashboard' && <Dashboard />}
          {view === 'menu'      && <MenuManager />}
          {view === 'inventory' && <InventoryManager />}
          {view === 'staff'     && <StaffManager />}
          {view === 'settings'  && <LocationSettings />}
        </div>
      )}

      {paymentOpen && <PaymentModal onClose={() => setPaymentOpen(false)} />}
    </div>
  )
}

function NavTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`h-full px-4 text-sm font-medium transition-colors border-b-2 ${
        active
          ? 'border-white text-white'
          : 'border-transparent text-white/60 hover:text-white/90'
      }`}
    >
      {children}
    </button>
  )
}
