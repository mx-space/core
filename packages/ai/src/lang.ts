const LANGUAGE_ALIAS_TO_CODE: Record<string, string> = {
  // English variants
  'en-us': 'en',
  'en-gb': 'en',
  'en-au': 'en',
  'en-ca': 'en',
  'en-nz': 'en',
  'en-ie': 'en',
  'en-za': 'en',
  // Chinese variants
  'zh-cn': 'zh',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  'zh-tw': 'zh',
  cn: 'zh',
  tw: 'zh',
  // Japanese/Korean common aliases
  jp: 'ja',
  'ja-jp': 'ja',
  kr: 'ko',
  'ko-kr': 'ko',
  // Portuguese variants
  'pt-br': 'pt',
  'pt-pt': 'pt',
  // Hebrew/Indonesian legacy codes
  iw: 'he',
  in: 'id',
  // Norwegian variants
  nb: 'no',
  nn: 'no',
}

const ISO_639_2_TO_1: Record<string, string> = {
  eng: 'en',
  zho: 'zh',
  chi: 'zh',
  jpn: 'ja',
  kor: 'ko',
  fra: 'fr',
  fre: 'fr',
  deu: 'de',
  ger: 'de',
  spa: 'es',
  por: 'pt',
  rus: 'ru',
  ita: 'it',
  nld: 'nl',
  dut: 'nl',
  swe: 'sv',
  dan: 'da',
  fin: 'fi',
  nor: 'no',
}

export const normalizeLanguageCode = (
  input?: string | null,
): string | undefined => {
  if (typeof input !== 'string') return undefined
  const trimmed = input.trim()
  if (!trimmed) return undefined

  const normalized = trimmed.toLowerCase().replaceAll('_', '-')
  const alias = LANGUAGE_ALIAS_TO_CODE[normalized]
  if (alias) return alias

  if (normalized.length === 2) {
    return normalized
  }

  if (normalized.length === 3) {
    return ISO_639_2_TO_1[normalized]
  }

  const base = normalized.split('-')[0]
  if (base.length === 2) {
    return base
  }
  if (base.length === 3) {
    return ISO_639_2_TO_1[base]
  }

  return undefined
}

// Folds a target-language token for dedup: recognized codes/aliases collapse
// via normalizeLanguageCode, unrecognized ones (a stray "english" typed into
// the free-input field) pass through as trim+lowercase instead of a default
// language, which would otherwise silently overwrite an unrelated valid row.
// A blank (or whitespace-only) token normalizes to undefined rather than '' —
// callers filter it out instead of generating a language named "".
//
// Admin and core MUST fold identically: the dashboard shows what it sent and
// the server dedupes what it received, so a divergence surfaces as a language
// column that never fills.
export const normalizeTargetLang = (lang: string): string | undefined => {
  const trimmed = lang.trim()
  if (!trimmed) return undefined
  return normalizeLanguageCode(trimmed) ?? trimmed.toLowerCase()
}
