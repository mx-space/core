import { DEFAULT_SUMMARY_LANG, LANGUAGE_CODE_TO_NAME } from './ai.constants'

/**
 * Extract the primary language code from an Accept-Language header or a language code.
 * Examples: "en-US,en;q=0.9" -> "en", "zh-CN" -> "zh"
 */
export function parseLanguageCode(lang?: string): string {
  if (!lang) return DEFAULT_SUMMARY_LANG
  return lang.split('-')[0].split(',')[0].toLowerCase()
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
