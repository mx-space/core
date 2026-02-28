/**
 * Extracts the first complete JSON object from a raw string.
 * Handles nested objects and strings with escaped quotes.
 *
 * @param raw - Raw string that may contain JSON (e.g. LLM output with markdown)
 * @returns The first complete JSON object as string, or null if not found
 */
export function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let quote: '"' | "'" | null = null
  let escaped = false

  for (let i = start; i < raw.length; i++) {
    const char = raw[i]

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '{') {
      depth++
      continue
    }

    if (char === '}') {
      depth--
      if (depth === 0) {
        return raw.slice(start, i + 1)
      }
    }
  }

  return null
}
