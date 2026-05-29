import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { PropsWithChildren } from 'react'
import type { Locale, TranslationKey, TranslationValues } from './types'

import { UI_LOCALE_STORAGE_KEY } from '../constants/keys'
import { formatDateTime, formatNumber, formatRelativeTime } from './formatters'
import { DEFAULT_LOCALE, messages, SUPPORTED_LOCALES } from './resources'

interface I18nContextValue {
  format: {
    dateTime: (
      value: Date | number | string | null | undefined,
      options?: Intl.DateTimeFormatOptions,
    ) => string
    number: (value: number, options?: Intl.NumberFormatOptions) => string
    relativeTime: (
      value: Date | number | string | null | undefined,
      current?: Date,
    ) => string
  }
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, values?: TranslationValues) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider(props: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale)

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    localStorage.setItem(UI_LOCALE_STORAGE_KEY, nextLocale)
    document.documentElement.lang = nextLocale
  }, [])

  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues) => {
      const template =
        messages[locale][key] ?? messages[DEFAULT_LOCALE][key] ?? key

      if (!values) return template

      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        Object.hasOwn(values, name) ? String(values[name]) : match,
      )
    },
    [locale],
  )

  const format = useMemo(
    () => ({
      dateTime: (
        value: Date | number | string | null | undefined,
        options?: Intl.DateTimeFormatOptions,
      ) => formatDateTime(value, locale, options),
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, locale, options),
      relativeTime: (
        value: Date | number | string | null | undefined,
        current?: Date,
      ) => formatRelativeTime(value, locale, current),
    }),
    [locale],
  )

  const value = useMemo(
    () => ({ format, locale, setLocale, t }),
    [format, locale, setLocale, t],
  )

  return (
    <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return context
}

export function isSupportedLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale)
}

function readInitialLocale(): Locale {
  const storedLocale = localStorage.getItem(UI_LOCALE_STORAGE_KEY)
  if (storedLocale && isSupportedLocale(storedLocale)) {
    document.documentElement.lang = storedLocale
    return storedLocale
  }

  const browserLocale =
    navigator.languages.find(isSupportedLocale) ||
    navigator.languages.find((locale) => locale.startsWith('zh')) ||
    navigator.language

  const locale = browserLocale?.startsWith('zh') ? 'zh-CN' : DEFAULT_LOCALE
  document.documentElement.lang = locale

  return locale
}
