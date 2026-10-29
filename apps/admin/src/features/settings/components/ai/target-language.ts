import { canonicalizeLanguageTag, isKnownLanguageTag } from '@mx-space/ai'

export type TargetLanguageDraft =
  { lang: string } | { error: 'invalid' } | { error: 'exists'; lang: string }

export function parseTargetLanguageDraft(
  draft: string,
  existing: readonly string[],
): TargetLanguageDraft {
  const token = draft.trim()
  if (!isKnownLanguageTag(token)) return { error: 'invalid' }
  const lang = canonicalizeLanguageTag(token)!
  return existing.includes(lang) ? { error: 'exists', lang } : { lang }
}
