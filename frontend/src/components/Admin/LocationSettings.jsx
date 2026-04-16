import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import api from '../../api/client.js'

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <h3 className="font-semibold text-gray-800 mb-4 pb-2 border-b">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  )
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

export default function LocationSettings() {
  const { user, updateUser } = useAuthStore()
  const [form,    setForm]    = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => { loadLocation() }, [])

  async function loadLocation() {
    try {
      const { data } = await api.get(`/locations/${user.location_id}`)
      setForm(data)
    } catch (e) { console.error(e) }
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.patch(`/locations/${user.location_id}`, form)
      setForm(data)
      // Update auth store so PaymentModal picks up new keys immediately
      updateUser({
        location_name:         data.name,
        address:               data.address,
        city:                  data.city,
        phone:                 data.phone,
        vat_number:            data.vat_number,
        yoco_public_key:       data.yoco_public_key,
        snap_scan_merchant_id: data.snap_scan_merchant_id,
        zapper_merchant_id:    data.zapper_merchant_id
      })
      setSaved(true)
    } catch (e) {
      alert(e.response?.data?.error ?? 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <div className="p-8 text-gray-400 text-sm">Loading settings...</div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Location Settings</h1>

      <form onSubmit={save} className="space-y-5">
        <Section title="Business Info">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Restaurant Name">
              <input className={INPUT} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} required />
            </Field>
            <Field label="Phone">
              <input className={INPUT} value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="010 123 4567" />
            </Field>
            <Field label="Address" >
              <input className={INPUT} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="City">
              <input className={INPUT} value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} placeholder="Cape Town" />
            </Field>
            <Field label="VAT Number" hint="Your SARS VAT registration number (shown on receipts)">
              <input className={INPUT} value={form.vat_number ?? ''} onChange={(e) => set('vat_number', e.target.value)} placeholder="4123456789" />
            </Field>
          </div>
        </Section>

        <Section title="Card Payments — Yoco">
          <div className="space-y-3">
            <Field
              label="Yoco Public Key"
              hint="From your Yoco dashboard → Developers → API Keys. Starts with pk_live_ or pk_test_"
            >
              <input
                className={INPUT}
                value={form.yoco_public_key ?? ''}
                onChange={(e) => set('yoco_public_key', e.target.value)}
                placeholder="pk_live_xxxxxxxxxxxxxxxx"
              />
            </Field>
            <p className="text-xs text-gray-400">
              Don't have a Yoco account?{' '}
              <span className="text-brand-600">Sign up at yoco.com — free card reader for new merchants.</span>
            </p>
          </div>
        </Section>

        <Section title="QR Payments — SnapScan">
          <Field
            label="SnapScan Merchant Code"
            hint="Your unique SnapScan code from snap.co.za. Customers scan this to pay."
          >
            <input
              className={INPUT}
              value={form.snap_scan_merchant_id ?? ''}
              onChange={(e) => set('snap_scan_merchant_id', e.target.value)}
              placeholder="e.g. MojaRestaurant"
            />
          </Field>
        </Section>

        <Section title="QR Payments — Zapper">
          <Field
            label="Zapper Merchant ID"
            hint="Your Zapper merchant ID from zapper.com."
          >
            <input
              className={INPUT}
              value={form.zapper_merchant_id ?? ''}
              onChange={(e) => set('zapper_merchant_id', e.target.value)}
              placeholder="e.g. 12345"
            />
          </Field>
        </Section>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-green-600 text-sm">✓ Saved successfully</span>}
        </div>
      </form>
    </div>
  )
}
