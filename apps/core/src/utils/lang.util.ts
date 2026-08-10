import { normalizeLanguageCode } from '@mx-space/ai'

export { normalizeLanguageCode }

export const resolveRequestedLanguage = (
  input: unknown,
  fallback?: string,
): string | undefined => {
  if (typeof input !== 'string') return fallback
  if (input.toLowerCase() === 'original') return undefined

  return normalizeLanguageCode(input) ?? fallback
}

export const parseAcceptLanguage = (
  header?: string | string[] | null,
): string | undefined => {
  if (Array.isArray(header)) {
    return parseAcceptLanguage(header.join(','))
  }
  if (typeof header !== 'string') return undefined
  const trimmed = header.trim()
  if (!trimmed) return undefined

  const parts = trimmed.split(',')
  for (const part of parts) {
    const token = part.trim().split(';')[0]?.trim()
    if (!token) continue
    const normalized = normalizeLanguageCode(token)
    if (normalized) return normalized
  }

  return undefined
}
