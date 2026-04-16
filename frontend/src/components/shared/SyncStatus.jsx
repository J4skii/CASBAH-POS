import React, { useState, useEffect } from 'react'
import { db } from '../../db/schema.js'
import { syncEngine } from '../../db/sync.js'

export default function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pending,  setPending]  = useState(0)
  const [syncing,  setSyncing]  = useState(false)

  useEffect(() => {
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    const interval = setInterval(async () => {
      const count = await db.sync_queue.where('status').equals('pending').count()
      setPending(count)
    }, 5_000)

    // Check immediately on mount
    db.sync_queue.where('status').equals('pending').count().then(setPending)

    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
  }, [])

  async function handleSync() {
    if (syncing || !isOnline) return
    setSyncing(true)
    try {
      await syncEngine.syncAll()
      const count = await db.sync_queue.where('status').equals('pending').count()
      setPending(count)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
      <span className="text-white/80">
        {isOnline ? 'Online' : 'Offline'}
        {pending > 0 && ` · ${pending} queued`}
      </span>
      {pending > 0 && isOnline && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
        >
          {syncing ? '...' : 'Sync now'}
        </button>
      )}
    </div>
  )
}
