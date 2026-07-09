import { omit } from 'es-toolkit/compat'

import type { SeoConfig } from '../configs/configs.schema'

export function resolveSeo(seo: SeoConfig, lang?: string) {
  const base = omit(seo, ['i18n'])
  if (!lang || lang === 'zh') return base

  const overlay = seo.i18n?.[lang] ?? seo.i18n?.en
  return { ...base, ...overlay }
}
