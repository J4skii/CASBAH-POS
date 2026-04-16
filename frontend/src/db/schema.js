import Dexie from 'dexie'

export const db = new Dexie('mojatill')

db.version(1).stores({
  orders:     'id, location_id, status, created_at',
  order_items:'++localId, order_id',
  categories: 'id, location_id',
  items:      'id, category_id, location_id',
  inventory:  'id, [location_id+item_id]',
  sync_queue: 'id, status, created_at'
})
