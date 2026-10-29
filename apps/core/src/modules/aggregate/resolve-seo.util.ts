import { canonicalizeLanguageTag } from '@mx-space/ai'
import { DEFAULT_SUMMARY_LANG } from '@mx-space/ai/prompts'
import { omit } from 'es-toolkit/compat'

import type { SeoConfig } from '../configs/configs.schema'

export function resolveSeo(seo: SeoConfig, lang?: string) {
  const base = omit(seo, ['i18n'])
  const tag = canonicalizeLanguageTag(lang)
  if (!tag) return base
  const language = new Intl.Locale(tag).language
  if (language === new Intl.Locale(DEFAULT_SUMMARY_LANG).language) return base

  const overlay = seo.i18n?.[language] ?? seo.i18n?.en
  return { ...base, ...overlay }
}
