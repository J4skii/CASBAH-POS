import React, { useEffect } from 'react'
import { useAuthStore } from './store/authStore.js'
import Login from './components/Auth/Login.jsx'
import POSLayout from './components/POS/POSLayout.jsx'
import KDSLayout from './components/KDS/KDSLayout.jsx'

export default function App() {
  const { user, loadFromStorage } = useAuthStore()

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  if (!user) return <Login />

  // Kitchen staff → KDS display
  if (user.role === 'kitchen') return <KDSLayout />

  // Cashier / manager / owner → POS (with admin tab for managers+)
  return <POSLayout />
}
