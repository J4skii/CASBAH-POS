import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import api from '../../api/client.js'

const ROLES = ['cashier', 'kitchen', 'manager', 'owner']

const ROLE_BADGE = {
  owner:   'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100   text-blue-700',
  cashier: 'bg-gray-100   text-gray-700',
  kitchen: 'bg-orange-100 text-orange-700'
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function StaffManager() {
  const { user } = useAuthStore()
  const [staff,   setStaff]   = useState([])
  const [newForm, setNewForm] = useState(null)  // null | { username, password, role }
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { loadStaff() }, [])

  async function loadStaff() {
    try {
      const { data } = await api.get(`/staff/${user.location_id}`)
      setStaff(data)
    } catch (e) { console.error(e) }
  }

  async function toggleActive(member) {
    try {
      await api.patch(`/staff/${member.id}`, { active: !member.active })
      loadStaff()
    } catch (e) { console.error(e) }
  }

  async function changeRole(member, role) {
    try {
      await api.patch(`/staff/${member.id}`, { role })
      loadStaff()
    } catch (e) { console.error(e) }
  }

  async function createStaff() {
    if (!newForm.username || !newForm.password) return
    setSaving(true)
    setError('')
    try {
      await api.post('/auth/register', newForm)
      setNewForm(null)
      loadStaff()
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to create staff')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
        <button
          onClick={() => setNewForm({ username: '', password: '', role: 'cashier' })}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-700"
        >
          + Add Staff
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm divide-y">
        {staff.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No staff yet</div>
        ) : staff.map((member) => (
          <div key={member.id} className="flex items-center gap-4 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
              {member.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-sm ${!member.active ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {member.username}
                {member.id === user.user_id && <span className="text-xs text-gray-400 ml-1">(you)</span>}
              </div>
              <div className="text-xs text-gray-400">
                Joined {new Date(member.created_at).toLocaleDateString('en-ZA')}
              </div>
            </div>

            {/* Role selector */}
            <select
              value={member.role}
              onChange={(e) => changeRole(member, e.target.value)}
              disabled={member.id === user.user_id}
              className={`text-xs px-2 py-1 rounded-lg border font-medium focus:outline-none ${ROLE_BADGE[member.role]} disabled:opacity-50`}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* Active toggle — can't deactivate yourself */}
            {member.id !== user.user_id && (
              <button
                onClick={() => toggleActive(member)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  member.active
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {member.active ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── New staff modal ── */}
      {newForm && (
        <Modal title="Add Staff Member" onClose={() => { setNewForm(null); setError('') }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={newForm.username}
                onChange={(e) => setNewForm({ ...newForm, username: e.target.value.toLowerCase() })}
                placeholder="e.g. sipho"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={newForm.password}
                onChange={(e) => setNewForm({ ...newForm, password: e.target.value })}
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={newForm.role}
                onChange={(e) => setNewForm({ ...newForm, role: e.target.value })}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setNewForm(null); setError('') }} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={createStaff}
                disabled={!newForm.username || !newForm.password || saving}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
