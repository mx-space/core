import {
  canonicalizeLanguageTag,
  matchLanguage,
  toScriptLevelTag,
} from '@mx-space/ai'

import { parseAcceptLanguage } from '~/utils/lang.util'

import { DEFAULT_SUMMARY_LANG } from './ai.constants'

export function normalizeTargetLangs(langs?: string[] | null): string[] {
  return [
    ...new Set(
      (langs ?? [])
        .map((lang) => canonicalizeLanguageTag(lang))
        .filter((lang): lang is string => lang !== undefined),
    ),
  ]
}

// Stored codes the canonicalizer rejects stay visible as-is rather than vanish.
export function canonicalizeStoredLang(lang: string): string {
  return canonicalizeLanguageTag(lang) ?? lang
}

export function resolveServedLanguage(
  lang: string | null | undefined,
  configuredTargets: string[] | null | undefined,
): string | undefined {
  const requested = canonicalizeLanguageTag(lang)
  if (!requested) return undefined
  const candidates = [
    ...normalizeTargetLangs(configuredTargets),
    DEFAULT_SUMMARY_LANG,
  ]
  return matchLanguage(requested, candidates) ?? toScriptLevelTag(requested)
}

export function resolveGenerationLanguage(
  lang: string | null | undefined,
  candidates: readonly string[],
): string | undefined {
  return matchLanguage(lang, candidates) ?? toScriptLevelTag(lang)
}

export function excludeSourceLanguage(
  targets: readonly string[],
  sourceLang: string,
): string[] {
  return targets.filter((lang) => !matchLanguage(lang, [sourceLang]))
}

export function findRowByLanguage<T extends { lang?: string | null }>(
  rows: readonly T[],
  lang: string | null | undefined,
): T | undefined {
  const rowLang = (row: T) => row.lang ?? DEFAULT_SUMMARY_LANG
  const matched = matchLanguage(lang, rows.map(rowLang))
  if (!matched) return undefined
  return rows.find((row) => canonicalizeLanguageTag(rowLang(row)) === matched)
}

export function parseLanguageCode(lang?: string): string {
  return parseAcceptLanguage(lang) ?? DEFAULT_SUMMARY_LANG
}

const languageNames = new Intl.DisplayNames(['en'], {
  type: 'language',
  fallback: 'none',
})

export function getLanguageName(langCode: string): string {
  const tag = canonicalizeLanguageTag(langCode)
  return (tag && languageNames.of(new Intl.Locale(tag).language)) || langCode
}

export function resolveTargetLanguages(
  explicit?: string[],
  configured?: string[],
): string[] {
  return explicit?.length ? explicit : (configured ?? [])
}

export function resolveArticleSourceLang(document: {
  meta?: Record<string, unknown> | null
}): string {
  const raw = document.meta?.lang
  return typeof raw === 'string' && raw.trim()
    ? parseLanguageCode(raw)
    : DEFAULT_SUMMARY_LANG
}
