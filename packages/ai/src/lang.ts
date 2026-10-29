const maximizeLanguageTag = (
  input?: string | null,
): Intl.Locale | undefined => {
  if (typeof input !== 'string') return undefined
  const trimmed = input.trim().replaceAll('_', '-')
  if (!trimmed) return undefined
  try {
    const locale = new Intl.Locale(trimmed).maximize()
    return locale.region ? locale : undefined
  } catch {
    return undefined
  }
}

const formatLanguageRegion = (locale: Intl.Locale): string =>
  `${locale.language}-${locale.region}`

export const canonicalizeLanguageTag = (
  input?: string | null,
): string | undefined => {
  const locale = maximizeLanguageTag(input)
  return locale ? formatLanguageRegion(locale) : undefined
}

const languageDisplayNames = new Intl.DisplayNames(['en'], {
  type: 'language',
  fallback: 'none',
})

export const isKnownLanguageTag = (input?: string | null): boolean => {
  const locale = maximizeLanguageTag(input)
  return !!locale && languageDisplayNames.of(locale.language) !== undefined
}

export const toScriptLevelTag = (input?: string | null): string | undefined => {
  const locale = maximizeLanguageTag(input)
  if (!locale) return undefined
  return canonicalizeLanguageTag(`${locale.language}-${locale.script}`)
}

export const matchLanguage = (
  requested: string | null | undefined,
  candidates: readonly string[],
): string | undefined => {
  const target = maximizeLanguageTag(requested)
  if (!target) return undefined
  const targetTag = formatLanguageRegion(target)

  let fallback: string | undefined
  for (const candidate of candidates) {
    const locale = maximizeLanguageTag(candidate)
    if (
      !locale ||
      locale.language !== target.language ||
      locale.script !== target.script
    ) {
      continue
    }
    const tag = formatLanguageRegion(locale)
    if (tag === targetTag) return tag
    fallback ??= tag
  }
  return fallback
}
