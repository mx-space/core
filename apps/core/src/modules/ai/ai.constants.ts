export const DEFAULT_SUMMARY_LANG = 'zh'

/** Redis lock TTL for AI streaming tasks (in seconds) */
export const AI_STREAM_LOCK_TTL = 60
/** Redis TTL for AI streaming results (in seconds) */
export const AI_STREAM_RESULT_TTL = 10 * 60
/** Max Redis Stream length for AI streaming */
export const AI_STREAM_MAXLEN = 2000
/** Redis Stream block time (ms) */
// 200ms balances smooth SSE animation and Redis load in dev
export const AI_STREAM_READ_BLOCK_MS = 200
/** Idle timeout for AI streaming follower (ms) */
export const AI_STREAM_IDLE_TIMEOUT_MS = 120_000

/** Maximum word count for AI-generated summaries */
export const AI_SUMMARY_MAX_WORDS = 150

/** Maximum character length for fallback slug generation */
export const AI_FALLBACK_SLUG_MAX_LENGTH = 50

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
  zh: 'Chinese',
}
