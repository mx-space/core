import type { Locale, TranslationKey, TranslationValues } from './types'

import { UI_LOCALE_STORAGE_KEY } from '../constants/keys'
import { DEFAULT_LOCALE, messages, SUPPORTED_LOCALES } from './resources'

function readActiveLocale(): Locale {
  if (typeof localStorage === 'undefined') return DEFAULT_LOCALE
  const stored = localStorage.getItem(UI_LOCALE_STORAGE_KEY)
  return stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)
    ? (stored as Locale)
    : DEFAULT_LOCALE
}

export function translate(
  key: TranslationKey,
  values?: TranslationValues,
): string {
  const locale = readActiveLocale()
  const template = messages[locale][key] ?? messages[DEFAULT_LOCALE][key] ?? key

  if (!values) return template

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  )
}
