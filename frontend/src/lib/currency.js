// ZAR currency utilities — South African Rand
// Locale: en-ZA — "R 1 234,56" (space thousands, comma decimal)

const formatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

/** Format cents to ZAR string: 1050 → "R 10,50" */
export function formatZAR(cents) {
  if (typeof cents !== 'number' || isNaN(cents)) return 'R 0,00'
  return formatter.format(cents / 100)
}

export function centsToRands(cents) {
  return cents / 100
}

/** Parse a rand string/number input to integer cents */
export function randsToCents(rands) {
  return Math.round(parseFloat(String(rands).replace(',', '.')) * 100)
}
