import React, { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuthStore } from '../../store/authStore.js'
import OrderCard from './OrderCard.jsx'
import api from '../../api/client.js'

export default function KDSLayout() {
  const { user, logout } = useAuthStore()
  const [orders, setOrders] = useState([])

  useEffect(() => {
    loadActive()

    const socket = io({
      auth: { token: localStorage.getItem('mojatill_token') }
    })
    socket.emit('subscribe:location', user.location_id)

    socket.on('order:created', (data) => {
      setOrders((prev) => {
        // Avoid duplicates
        if (prev.some((o) => o.order_id === data.order_id)) return prev
        return [data, ...prev]
      })
    })

    socket.on('order:status', ({ order_id, status }) => {
      if (['ready', 'delivered', 'voided'].includes(status)) {
        setOrders((prev) => prev.filter((o) => o.order_id !== order_id))
      }
    })

    return () => socket.disconnect()
  }, [])

  async function loadActive() {
    try {
      const { data } = await api.get(`/orders/${user.location_id}?status=paid`)
      setOrders(
        data.map((o) => ({
          order_id:     o.id,
          order_number: o.order_number,
          items:        [],
          notes:        o.notes,
          created_at:   o.created_at
        }))
      )
    } catch (err) {
      console.error('KDS: failed to load active orders:', err)
    }
  }

  async function markReady(order_id) {
    try {
      await api.patch(`/orders/${order_id}/status`, {
        status:      'ready',
        location_id: user.location_id
      })
      setOrders((prev) => prev.filter((o) => o.order_id !== order_id))
    } catch (err) {
      console.error('KDS: failed to mark ready:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 px-5 py-3 flex items-center justify-between border-b border-gray-700">
        <div>
          <span className="font-bold text-xl text-brand-400">MojaTill</span>
          <span className="text-gray-400 text-sm ml-2">Kitchen Display</span>
        </div>
        <span className="text-gray-400 text-sm">
          {orders.length} order{orders.length !== 1 ? 's' : ''} active
        </span>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-white">
          Sign Out
        </button>
      </header>

      <div className="flex-1 p-4 overflow-auto">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
            <span className="text-5xl">🍳</span>
            <span>No active orders — all clear!</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {orders.map((order) => (
              <OrderCard
                key={order.order_id}
                order={order}
                onReady={() => markReady(order.order_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
