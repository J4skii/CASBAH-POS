import React, { useState, useEffect } from 'react'
import { db } from '../../db/schema.js'

export default function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pending,  setPending]  = useState(0)

  useEffect(() => {
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    const interval = setInterval(async () => {
      const count = await db.sync_queue.where('status').equals('pending').count()
      setPending(count)
    }, 5_000)

    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
      <span className="text-white/80">
        {isOnline ? 'Online' : 'Offline'}
        {pending > 0 && ` · ${pending} queued`}
      </span>
    </div>
  )
}
