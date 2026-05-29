import type { zhCN } from './resources/zh-CN'

export type Locale = 'en-US' | 'zh-CN'

export type TranslationKey = keyof typeof zhCN

export type TranslationValues = Record<string, number | string>
