import { DEFAULT_SUMMARY_LANG, LANGUAGE_CODE_TO_NAME } from './ai.constants'

/**
 * 从 Accept-Language header 或语言代码中提取主语言代码
 * 例如: "en-US,en;q=0.9" -> "en", "zh-CN" -> "zh"
 */
export function parseLanguageCode(lang?: string): string {
  if (!lang) return DEFAULT_SUMMARY_LANG
  return lang.split('-')[0].split(',')[0].toLowerCase()
}

/**
 * 获取语言的完整名称
 * 例如: "en" -> "English", "zh" -> "Chinese"
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
