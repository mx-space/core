const REGIONAL_ALIAS_TO_CODE: Record<string, string> = {
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
  'ja-jp': 'ja',
  'ko-kr': 'ko',
  // Portuguese variants
  'pt-br': 'pt',
  'pt-pt': 'pt',
}

const REGIONAL_SHORTHAND_TO_TAG: Record<string, string> = {
  cn: 'zh-cn',
  tw: 'zh-tw',
}

const LANGUAGE_ALIAS_TO_CODE: Record<string, string> = {
  jp: 'ja',
  kr: 'ko',
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

export interface LanguageNormalizeOptions {
  foldRegion?: boolean
}

const resolveBaseCode = (base: string): string | undefined => {
  const alias = LANGUAGE_ALIAS_TO_CODE[base]
  if (alias) return alias
  if (base.length === 2) return base
  if (base.length === 3) return ISO_639_2_TO_1[base]
  return undefined
}

const formatSubtag = (subtag: string): string => {
  if (/^[a-z]{2}$/.test(subtag) || /^\d{3}$/.test(subtag)) {
    return subtag.toUpperCase()
  }
  if (/^[a-z]{4}$/.test(subtag)) {
    return subtag[0].toUpperCase() + subtag.slice(1)
  }
  return subtag
}

const normalizeRegionalTag = (normalized: string): string | undefined => {
  const tag = REGIONAL_SHORTHAND_TO_TAG[normalized] ?? normalized
  const [base, ...subtags] = tag.split('-')
  const code = resolveBaseCode(base)
  if (!code) return undefined
  const rest = subtags.filter(Boolean).map(formatSubtag)
  return [code, ...rest].join('-')
}

export const normalizeLanguageCode = (
  input?: string | null,
  options: LanguageNormalizeOptions = {},
): string | undefined => {
  if (typeof input !== 'string') return undefined
  const trimmed = input.trim()
  if (!trimmed) return undefined

  const normalized = trimmed.toLowerCase().replaceAll('_', '-')

  if (options.foldRegion === false) {
    return normalizeRegionalTag(normalized)
  }

  const alias =
    REGIONAL_ALIAS_TO_CODE[normalized] ?? LANGUAGE_ALIAS_TO_CODE[normalized]
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
export const normalizeTargetLang = (
  lang: string,
  options: LanguageNormalizeOptions = {},
): string | undefined => {
  const trimmed = lang.trim()
  if (!trimmed) return undefined
  return normalizeLanguageCode(trimmed, options) ?? trimmed.toLowerCase()
}
