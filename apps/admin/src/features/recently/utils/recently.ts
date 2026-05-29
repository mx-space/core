import type { TranslationKey } from '~/i18n/types'

import { URL_REGEX, URL_TAIL_TRIM } from '../constants'

type Translator = (key: TranslationKey) => string

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX)
  if (!matches) return []

  const seen = new Set<string>()
  const result: string[] = []

  for (let url of matches) {
    while (URL_TAIL_TRIM.test(url)) {
      url = url.replace(URL_TAIL_TRIM, '')
    }

    if (url && !seen.has(url)) {
      seen.add(url)
      result.push(url)
    }
  }

  return result
}

export function cleanErrorMessage(
  raw: string | null | undefined,
  t: Translator,
): string {
  if (!raw) return t('recently.error.parseFailed')

  let message = raw.replace(/https?:\/\/\S+/g, '').trim()

  if (/\(404\)|\b404\b/.test(message)) {
    return t('recently.error.notFound')
  }

  if (/\b401\b|\b403\b|unauthor|forbidden/i.test(message)) {
    return t('recently.error.unauthorized')
  }

  if (/Provider disabled/i.test(message)) {
    return t('recently.error.providerDisabled')
  }

  if (/Token missing/i.test(message)) {
    return t('recently.error.tokenMissing')
  }

  message = message.replace(/[\s-]+$/, '').trim()

  return message.length > 100
    ? `${message.slice(0, 100)}...`
    : message || t('recently.error.parseFailed')
}

export function hostnameOf(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}
