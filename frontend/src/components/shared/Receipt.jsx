import { formatZAR } from '../../lib/currency.js'
import { extractVAT } from '../../lib/vat.js'

/**
 * Print a SA VAT-compliant tax invoice to a new window.
 * @param {object} order  - order object with items, totals, payment info
 * @param {object} location - { name, address, city, phone, vat_number }
 */
export function printReceipt(order, location = {}) {
  const html = buildHTML(order, location)
  const w = window.open('', '_blank', 'width=380,height=700,scrollbars=yes')
  if (!w) { alert('Pop-up blocked — please allow pop-ups for this site.'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 300)
}

function buildHTML(order, location) {
  const date = new Date(order.created_at ?? Date.now())
  const dateStr = date.toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Africa/Johannesburg'
  })
  const timeStr = date.toLocaleTimeString('en-ZA', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Johannesburg'
  })

  const subtotal      = order.subtotal_cents ?? 0
  const discount      = order.discount_cents ?? 0
  const total         = order.total_cents ?? 0
  const vat           = order.vat_cents ?? extractVAT(total)
  const cashTendered  = order.cash_tendered_cents
  const change        = order.change_cents ?? 0

  const methodLabel = {
    cash:       'Cash',
    card_yoco:  'Card (Yoco)',
    snapscan:   'SnapScan',
    zapper:     'Zapper'
  }[order.payment_method] ?? order.payment_method

  const orderTypeLabel = {
    dine_in:    'Dine In',
    takeaway:   'Takeaway',
    collection: 'Collection'
  }[order.order_type] ?? ''

  const itemRows = (order.items ?? []).map((item) => {
    const lineTotal = (item.unit_price_cents ?? 0) * (item.quantity ?? 1)
    const modLines  = item.modifiers && Object.keys(item.modifiers).length > 0
      ? Object.entries(item.modifiers).flatMap(([g, opts]) =>
          (Array.isArray(opts) ? opts : [opts]).map((o) => `<div class="mod">  + ${o}</div>`)
        ).join('')
      : ''
    return `
      <tr>
        <td>${item.quantity ?? 1} x ${item.name ?? item.item_name}</td>
        <td class="r">${formatZAR(lineTotal)}</td>
      </tr>
      ${modLines ? `<tr><td colspan="2">${modLines}</td></tr>` : ''}
    `
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt #${order.order_number ?? ''}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 320px; padding: 12px; color: #000; }
  h1 { font-size: 16px; text-align: center; letter-spacing: 2px; margin-bottom: 2px; }
  .biz { text-align: center; margin-bottom: 8px; }
  .biz .name { font-size: 14px; font-weight: bold; }
  .biz .sub  { font-size: 11px; color: #333; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .meta { font-size: 11px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  td { padding: 2px 0; font-size: 12px; vertical-align: top; }
  td.r { text-align: right; white-space: nowrap; }
  .mod { font-size: 10px; color: #555; padding-left: 8px; }
  .totals td { padding: 1px 0; }
  .totals .bold td { font-weight: bold; font-size: 14px; }
  .totals .vat td { font-size: 10px; color: #555; }
  .totals .discount td { color: #c00; }
  .footer { text-align: center; font-size: 10px; color: #555; margin-top: 8px; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body { width: 100%; }
  }
</style>
</head>
<body>
  <h1>TAX INVOICE</h1>
  <div class="biz">
    <div class="name">${location.name ?? 'MojaTill'}</div>
    ${location.address ? `<div class="sub">${location.address}${location.city ? ', ' + location.city : ''}</div>` : ''}
    ${location.phone   ? `<div class="sub">Tel: ${location.phone}</div>` : ''}
    ${location.vat_number ? `<div class="sub">VAT Reg: ${location.vat_number}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="meta">Receipt #: ${order.order_number ?? '—'}</div>
  <div class="meta">Date: ${dateStr} ${timeStr}</div>
  ${order.staff_name ? `<div class="meta">Served by: ${order.staff_name}</div>` : ''}
  ${orderTypeLabel    ? `<div class="meta">Type: ${orderTypeLabel}</div>` : ''}

  <div class="divider"></div>

  <table>
    ${itemRows}
  </table>

  <div class="divider"></div>

  <table class="totals">
    ${subtotal !== total || discount > 0 ? `<tr><td>Subtotal</td><td class="r">${formatZAR(subtotal)}</td></tr>` : ''}
    ${discount > 0 ? `<tr class="discount"><td>Discount${order.discount_note ? ' (' + order.discount_note + ')' : ''}</td><td class="r">-${formatZAR(discount)}</td></tr>` : ''}
    <tr class="bold"><td>TOTAL</td><td class="r">${formatZAR(total)}</td></tr>
    <tr class="vat"><td>VAT (15% incl.)</td><td class="r">${formatZAR(vat)}</td></tr>
  </table>

  <div class="divider"></div>

  <table class="totals">
    <tr><td>Payment</td><td class="r">${methodLabel}</td></tr>
    ${cashTendered ? `<tr><td>Cash Tendered</td><td class="r">${formatZAR(cashTendered)}</td></tr>` : ''}
    ${cashTendered && change > 0 ? `<tr><td><b>Change Due</b></td><td class="r"><b>${formatZAR(change)}</b></td></tr>` : ''}
  </table>

  ${order.notes ? `<div class="divider"></div><div class="meta">Notes: ${order.notes}</div>` : ''}

  <div class="divider"></div>
  <div class="footer">Thank you for your visit!<br>Powered by MojaTill</div>
</body>
</html>`
}
