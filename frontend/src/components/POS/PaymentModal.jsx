import React, { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useOrderStore } from '../../store/orderStore.js'
import { formatZAR, randsToCents } from '../../lib/currency.js'
import { syncEngine } from '../../db/sync.js'
import { printReceipt } from '../shared/Receipt.jsx'

const METHODS = [
  { id: 'cash',      label: 'Cash',         icon: '💵', shortcut: 'F1', colour: 'bg-green-600 hover:bg-green-700' },
  { id: 'card_yoco', label: 'Card (Yoco)',   icon: '💳', shortcut: 'F2', colour: 'bg-blue-600  hover:bg-blue-700'  },
  { id: 'snapscan',  label: 'SnapScan',      icon: '📱', shortcut: 'F3', colour: 'bg-red-600   hover:bg-red-700'   },
  { id: 'zapper',    label: 'Zapper',        icon: '⚡', shortcut: 'F4', colour: 'bg-purple-600 hover:bg-purple-700' }
]

export default function PaymentModal({ onClose }) {
  const { current_order, completeSale } = useOrderStore()
  const [selected,    setSelected]    = useState(null)
  const [cashInput,   setCashInput]   = useState('')
  const [processing,  setProcessing]  = useState(false)
  const [result,      setResult]      = useState(null)  // { change, order }

  const user = JSON.parse(localStorage.getItem('mojatill_user') ?? '{}')

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (processing || result) return
      if (e.key === 'Escape') { if (!selected) onClose(); else setSelected(null); return }
      if (selected) {
        if (e.key === 'Enter' && selected === 'cash') { e.preventDefault(); handleCash(); return }
        return
      }
      if (e.key === 'F1') { e.preventDefault(); setSelected('cash') }
      if (e.key === 'F2') { e.preventDefault(); handleYoco() }
      if (e.key === 'F3') { e.preventDefault(); setSelected('snapscan') }
      if (e.key === 'F4') { e.preventDefault(); setSelected('zapper') }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected, processing, result, cashInput])

  const { total_cents } = current_order

  const cashCents   = cashInput ? randsToCents(cashInput) : 0
  const changeCents = cashCents - total_cents

  // ── Finalise any payment ──────────────────────────────────────
  async function finish(method, cashTendered = null) {
    setProcessing(true)
    const res = await completeSale(method, cashTendered)
    setProcessing(false)
    if (res.success) {
      setResult({
        change: cashTendered ? changeCents : null,
        order:  res.order
      })
      syncEngine.syncAll()
    }
  }

  // ── Cash confirm ──────────────────────────────────────────────
  function handleCash() {
    if (cashCents < total_cents || processing) return
    finish('cash', cashCents)
  }

  // ── Yoco SDK popup ────────────────────────────────────────────
  function handleYoco() {
    const publicKey = user.yoco_public_key
    if (!publicKey) {
      alert('Yoco public key not configured. Ask your manager to add it in location settings.')
      return
    }
    const yoco = new window.YocoSDK({ publicKey })
    yoco.showPopup({
      amountInCents: total_cents,
      currency:      'ZAR',
      name:          user.location_name ?? 'MojaTill',
      description:   current_order.items.map((i) => i.name).join(', '),
      callback: async (response) => {
        if (response.error) {
          alert(`Card payment failed: ${response.error.message}`)
          return
        }
        await finish('card_yoco')
      }
    })
  }

  // ── Print receipt helper ──────────────────────────────────────
  function handlePrint(order) {
    printReceipt(order ?? {}, {
      name:       user.location_name,
      vat_number: user.vat_number,
      address:    user.address,
      city:       user.city,
      phone:      user.phone
    })
  }

  // ── QR URLs ───────────────────────────────────────────────────
  const snapUrl   = `https://pos.snapscan.io/qr/${user.snap_scan_merchant_id ?? 'SETUP_REQUIRED'}?amount=${total_cents}&strictAmountCheck=true`
  const zapperUrl = `https://zapper.com/qr?merchant=${user.zapper_merchant_id ?? 'SETUP_REQUIRED'}&amount=${total_cents / 100}`

  // ── Success screen ────────────────────────────────────────────
  if (result) {
    return (
      <Overlay>
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Payment Received</h2>
          {result.change > 0 && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 my-4">
              <div className="text-sm text-brand-700 font-medium">Change due</div>
              <div className="text-4xl font-bold text-brand-700">{formatZAR(result.change)}</div>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handlePrint(result.order)}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50"
            >
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold text-lg hover:bg-brand-700"
            >
              Next Order
            </button>
          </div>
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Choose Payment</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
      </div>

      <div className="text-center mb-5">
        <div className="text-sm text-gray-500">Total</div>
        <div className="text-4xl font-bold text-brand-700">{formatZAR(total_cents)}</div>
      </div>

      {/* Method selection */}
      {!selected && (
        <div className="grid grid-cols-2 gap-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                if (m.id === 'card_yoco') { handleYoco(); return }
                setSelected(m.id)
              }}
              className={`${m.colour} text-white flex flex-col items-center gap-2 py-5 rounded-xl font-semibold transition-colors active:scale-95`}
            >
              <span className="text-3xl">{m.icon}</span>
              <span>{m.label}</span>
              <span className="text-xs opacity-70">{m.shortcut}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Cash flow ─────────────────────────────────────────── */}
      {selected === 'cash' && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Cash tendered (R)</span>
            <input
              type="number"
              step="0.01"
              min={(total_cents / 100).toFixed(2)}
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value)}
              className="mt-1 w-full border-2 border-gray-300 rounded-xl px-4 py-4 text-2xl font-bold text-center focus:outline-none focus:border-brand-500"
              placeholder="0.00"
              autoFocus
            />
          </label>

          {cashCents >= total_cents && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 text-center">
              <div className="text-sm text-brand-700">Change</div>
              <div className="text-2xl font-bold text-brand-700">{formatZAR(changeCents)}</div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setSelected(null)} className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50">
              Back
            </button>
            <button
              onClick={handleCash}
              disabled={cashCents < total_cents || processing}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* ── SnapScan QR ───────────────────────────────────────── */}
      {selected === 'snapscan' && (
        <div className="text-center space-y-4">
          <p className="text-sm text-gray-600">Ask customer to scan with SnapScan</p>
          <div className="flex justify-center p-4 bg-white border-2 border-gray-200 rounded-xl">
            <QRCodeSVG value={snapUrl} size={200} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSelected(null)} className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700">Back</button>
            <button
              onClick={() => finish('snapscan')}
              disabled={processing}
              className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {processing ? '...' : 'Payment Received ✓'}
            </button>
          </div>
        </div>
      )}

      {/* ── Zapper QR ────────────────────────────────────────── */}
      {selected === 'zapper' && (
        <div className="text-center space-y-4">
          <p className="text-sm text-gray-600">Ask customer to scan with Zapper</p>
          <div className="flex justify-center p-4 bg-white border-2 border-gray-200 rounded-xl">
            <QRCodeSVG value={zapperUrl} size={200} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSelected(null)} className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700">Back</button>
            <button
              onClick={() => finish('zapper')}
              disabled={processing}
              className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50"
            >
              {processing ? '...' : 'Payment Received ✓'}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  )
}

function Overlay({ children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        {children}
      </div>
    </div>
  )
}
