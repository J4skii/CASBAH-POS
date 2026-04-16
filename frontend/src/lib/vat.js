// South African VAT — VAT Act No. 89 of 1991
// Standard rate: 15% (effective 1 April 2018)
// F&B restaurants: all items standard rated (15%)
// Prices on menu are VAT-INCLUSIVE (most common SA practice)

export const VAT_RATE   = 0.15
export const VAT_FACTOR = VAT_RATE / (1 + VAT_RATE) // 15/115 ≈ 0.130435

/**
 * Extract VAT amount from a VAT-inclusive price.
 * e.g. R100 inclusive → VAT = R13.04
 */
export function extractVAT(inclCents) {
  return Math.round(inclCents * VAT_FACTOR)
}

/**
 * Get the VAT-exclusive (nett) amount from an inclusive price.
 */
export function vatExclusive(inclCents) {
  return inclCents - extractVAT(inclCents)
}

/**
 * Add VAT to a VAT-exclusive price (less common in SA F&B).
 */
export function addVAT(exclCents) {
  return Math.round(exclCents * (1 + VAT_RATE))
}
