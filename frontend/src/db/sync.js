import { db } from './schema.js'

export class SyncEngine {
  constructor(apiBaseUrl = '/api') {
    this.apiBaseUrl = apiBaseUrl
    this.isOnline   = navigator.onLine
    this._onOnline  = this._onOnline.bind(this)
    this._onOffline = this._onOffline.bind(this)
    window.addEventListener('online',  this._onOnline)
    window.addEventListener('offline', this._onOffline)
  }

  _onOnline() {
    console.log('[MojaTill] Back online — starting sync...')
    this.isOnline = true
    this.syncAll()
  }

  _onOffline() {
    console.log('[MojaTill] Offline — transactions will queue locally.')
    this.isOnline = false
  }

  destroy() {
    window.removeEventListener('online',  this._onOnline)
    window.removeEventListener('offline', this._onOffline)
    this.stopPeriodicSync()
  }

  async syncAll() {
    const token = localStorage.getItem('mojatill_token')
    if (!token || !this.isOnline) return

    const pending = await db.sync_queue.where('status').equals('pending').toArray()
    if (pending.length === 0) return

    console.log(`[MojaTill] Syncing ${pending.length} queued order(s)...`)

    for (const item of pending) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/orders`, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${token}`
          },
          body: JSON.stringify(item.data)
        })

        if (res.ok) {
          await db.sync_queue.update(item.id, { status: 'synced', updated_at: new Date().toISOString() })
          console.log(`[MojaTill] ✓ Synced order ${item.data.id}`)
        } else {
          throw new Error(`HTTP ${res.status}`)
        }
      } catch (err) {
        console.error(`[MojaTill] ✗ Sync failed for ${item.id}:`, err.message)
        const attempts = (item.attempt_count ?? 0) + 1
        await db.sync_queue.update(item.id, {
          attempt_count: attempts,
          status:        attempts >= 5 ? 'failed' : 'pending',
          updated_at:    new Date().toISOString()
        })
      }

      // Small delay so we don't hammer the server
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  startPeriodicSync(intervalMs = 30_000) {
    this._interval = setInterval(() => {
      if (this.isOnline) this.syncAll()
    }, intervalMs)
  }

  stopPeriodicSync() {
    if (this._interval) clearInterval(this._interval)
  }
}

// Singleton — import this everywhere you need sync
export const syncEngine = new SyncEngine()
