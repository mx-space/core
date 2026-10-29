import { canonicalizeLanguageTag } from '../lang'

export const DEFAULT_SUMMARY_LANG = 'zh-CN'

export const AI_SUMMARY_MAX_WORDS = 150

const languageNames = new Intl.DisplayNames(['en'], {
  type: 'language',
  fallback: 'none',
})
const scriptNames = new Intl.DisplayNames(['en'], {
  type: 'script',
  fallback: 'none',
})

export const resolveLanguageName = (
  code?: string | null,
): string | undefined => {
  const tag = canonicalizeLanguageTag(code)
  if (!tag) return undefined
  const locale = new Intl.Locale(tag).maximize()
  const name = languageNames.of(tag)
  const script = locale.script ? scriptNames.of(locale.script) : undefined
  if (!name) return undefined
  return script ? `${name}, ${script} script` : name
}

export const resolveBaseLanguageCode = (code: string): string => {
  const tag = canonicalizeLanguageTag(code)
  return tag ? new Intl.Locale(tag).language : code
}
