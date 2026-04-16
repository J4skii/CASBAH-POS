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
import OrderHistory from '../Admin/OrderHistory.jsx'
import SyncStatus from '../shared/SyncStatus.jsx'
import api from '../../api/client.js'

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard', roles: ['manager', 'owner'] },
  { id: 'orders',    label: 'Orders',    roles: ['manager', 'owner'] },
  { id: 'menu',      label: 'Menu',      roles: ['manager', 'owner'] },
  { id: 'inventory', label: 'Inventory', roles: ['manager', 'owner'] },
  { id: 'staff',     label: 'Staff',     roles: ['manager', 'owner'] },
  { id: 'settings',  label: 'Settings',  roles: ['owner'] }
]

function ChangePasswordModal({ onClose }) {
  const [form,   setForm]   = useState({ current: '', next: '', confirm: '' })
  const [error,  setError]  = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.next !== form.confirm) { setError('New passwords do not match'); return }
    if (form.next.length < 6) { setError('New password must be at least 6 characters'); return }
    setSaving(true)
    try {
      await api.post('/staff/change-password', {
        current_password: form.current,
        new_password:     form.next
      })
      onClose()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              type="password"
              autoFocus
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-semibold text-sm hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function POSLayout() {
  const { user, logout } = useAuthStore()
  const [paymentOpen,  setPaymentOpen]  = useState(false)
  const [view,         setView]         = useState('pos')
  const [changePwOpen, setChangePwOpen] = useState(false)

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

          <NavTab active={view === 'pos'} onClick={() => setView('pos')}>
            Till
          </NavTab>

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
              onClick={() => setChangePwOpen(true)}
              className="bg-brand-800 hover:bg-brand-900 px-2 py-1 rounded text-xs transition-colors"
            >
              Password
            </button>
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
          {view === 'orders'    && <OrderHistory />}
          {view === 'menu'      && <MenuManager />}
          {view === 'inventory' && <InventoryManager />}
          {view === 'staff'     && <StaffManager />}
          {view === 'settings'  && <LocationSettings />}
        </div>
      )}

      {paymentOpen  && <PaymentModal onClose={() => setPaymentOpen(false)} />}
      {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} />}
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
