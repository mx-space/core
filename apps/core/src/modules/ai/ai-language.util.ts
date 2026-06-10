import { parseAcceptLanguage } from '~/utils/lang.util'

import { DEFAULT_SUMMARY_LANG, LANGUAGE_CODE_TO_NAME } from './ai.constants'

/**
 * Extract the primary language code from an Accept-Language header or a language code.
 * Examples: "en-US,en;q=0.9" -> "en", "zh-CN" -> "zh", "jp" -> "ja"
 *
 * Codes unknown to the alias tables (e.g. "fil", "yue") fall back to the
 * lowercased base segment instead of the default, so valid ISO codes are
 * never silently collapsed to DEFAULT_SUMMARY_LANG.
 */
export function parseLanguageCode(lang?: string): string {
  const normalized = parseAcceptLanguage(lang)
  if (normalized) return normalized

  const base = lang
    ?.split(',')[0]
    ?.split(';')[0]
    ?.trim()
    .split('-')[0]
    ?.toLowerCase()
  if (base && /^[a-z]{2,3}$/.test(base)) return base

  return DEFAULT_SUMMARY_LANG
}

/**
 * Get the full name for a language code.
 * Examples: "en" -> "English", "zh" -> "Chinese"
 */
export function getLanguageName(langCode: string): string {
  return LANGUAGE_CODE_TO_NAME[langCode] || langCode
}

export function resolveTargetLanguages(
  explicit?: string[],
  configured?: string[],
): string[] {
  return explicit?.length ? explicit : (configured ?? [])
}
