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

export interface ResolveLanguageOptions {
  preferredLang?: string
  acceptLanguage?: string
}

export interface ResolveLanguageConfig {
  configuredLanguage?: string
  defaultLanguage?: string
}

/**
 * 解析目标语言
 * 优先级：
 * 1. 如果配置语言不是 'auto'，使用配置语言
 * 2. 否则使用 preferredLang（用户明确指定）
 * 3. 否则使用 acceptLanguage（浏览器请求头）
 * 4. 最后使用默认语言
 */
export function resolveTargetLanguage(
  options: ResolveLanguageOptions,
  config: ResolveLanguageConfig,
): string {
  const { preferredLang, acceptLanguage } = options
  const { configuredLanguage, defaultLanguage = DEFAULT_SUMMARY_LANG } = config

  // 如果配置了特定语言（非 auto），直接使用
  if (configuredLanguage && configuredLanguage !== 'auto') {
    return configuredLanguage
  }

  // auto 模式：从用户偏好或请求头推断
  const userLang = preferredLang || acceptLanguage
  if (userLang) {
    return parseLanguageCode(userLang)
  }

  return defaultLanguage
}
