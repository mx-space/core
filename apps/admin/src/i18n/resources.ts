import type { Locale, TranslationKey } from './types'

import { enUS } from './resources/en-US'
import { zhCN } from './resources/zh-CN'

export const DEFAULT_LOCALE: Locale = 'zh-CN'

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const

export const messages: Record<Locale, Record<TranslationKey, string>> = {
  'en-US': enUS,
  'zh-CN': zhCN,
}
