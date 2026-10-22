import { normalizeLanguageCode } from '../lang'

export const DEFAULT_SUMMARY_LANG = 'zh'

export const AI_SUMMARY_MAX_WORDS = 150

export const LANGUAGE_CODE_TO_NAME: Record<string, string> = {
  ar: 'Arabic',
  bg: 'Bulgarian',
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  es: 'Spanish',
  et: 'Estonian',
  fa: 'Persian',
  fi: 'Finnish',
  fr: 'French',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  id: 'Indonesian',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  lt: 'Lithuanian',
  lv: 'Latvian',
  ms: 'Malay',
  nl: 'Dutch',
  no: 'Norwegian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sk: 'Slovak',
  sl: 'Slovenian',
  sr: 'Serbian',
  sv: 'Swedish',
  sw: 'Swahili',
  th: 'Thai',
  tl: 'Tagalog',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
  zh: 'Simplified Chinese',
}

const REGIONAL_LANGUAGE_CODE_TO_NAME: Record<string, string> = {
  'zh-hans': 'Simplified Chinese',
  'zh-cn': 'Simplified Chinese',
  'zh-sg': 'Simplified Chinese',
  'zh-my': 'Simplified Chinese',
  'zh-hant': 'Traditional Chinese',
  'zh-tw': 'Traditional Chinese',
  'zh-hk': 'Traditional Chinese',
  'zh-mo': 'Traditional Chinese',
  'pt-br': 'Brazilian Portuguese',
  'pt-pt': 'European Portuguese',
  'en-us': 'American English',
  'en-gb': 'British English',
  'es-419': 'Latin American Spanish',
  'es-mx': 'Mexican Spanish',
  'es-es': 'European Spanish',
  'fr-ca': 'Canadian French',
  'sr-latn': 'Serbian (Latin script)',
  'sr-cyrl': 'Serbian (Cyrillic script)',
}

export const resolveLanguageName = (
  code?: string | null,
): string | undefined => {
  const tag = normalizeLanguageCode(code, { foldRegion: false })
  if (!tag) return undefined
  const subtags = tag.toLowerCase().split('-')
  for (let end = subtags.length; end > 0; end--) {
    const key = subtags.slice(0, end).join('-')
    const name =
      REGIONAL_LANGUAGE_CODE_TO_NAME[key] ?? LANGUAGE_CODE_TO_NAME[key]
    if (name) return name
  }
  return undefined
}

export const resolveBaseLanguageCode = (code: string): string =>
  normalizeLanguageCode(code) ?? code
