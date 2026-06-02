const FALLBACK_FLAG = '🏳️'

const REGIONAL_OFFSET = 0x1f1e6
const ASCII_A = 'A'.charCodeAt(0)

/**
 * Convert an ISO-3166 alpha-2 country code to its flag emoji (e.g. `CN` →
 * 🇨🇳). Returns the white flag glyph when input is missing or invalid so the
 * caller can render the muted fallback unconditionally.
 */
export function countryFlag(code?: string): string {
  if (!code) return FALLBACK_FLAG
  const trimmed = code.trim()
  if (trimmed.length !== 2) return FALLBACK_FLAG
  const upper = trimmed.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return FALLBACK_FLAG
  const first = upper.charCodeAt(0) - ASCII_A + REGIONAL_OFFSET
  const second = upper.charCodeAt(1) - ASCII_A + REGIONAL_OFFSET
  return String.fromCodePoint(first, second)
}
