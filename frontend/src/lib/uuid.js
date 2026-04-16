/** Cryptographically secure UUID v4 — available in all modern browsers */
export function generateUUID() {
  return crypto.randomUUID()
}
