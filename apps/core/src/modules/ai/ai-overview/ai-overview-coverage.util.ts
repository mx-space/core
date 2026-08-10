import { CollectionRefTypes } from '~/constants/db.constant'

import type {
  AiOverviewCapability,
  ArticleCoverage,
  CapabilityCoverage,
} from './ai-overview.types'
import { AI_OVERVIEW_CAPABILITIES } from './ai-overview.types'

export interface CoverageInput {
  type: CollectionRefTypes
  /** Normalised `meta.lang`, or null when the article does not declare one. */
  metaLang: string | null
  summaryLangs: string[]
  insightsLangs: string[]
  translationLangs: string[]
  translationSourceLangs: string[]
  ttsLangs: string[]
  configured: {
    summary: string[]
    insights: string[]
    translation: string[]
  }
}

const uniqSorted = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort()

function capability(
  langs: string[],
  expected: string[],
  applicable: boolean,
): CapabilityCoverage {
  return {
    langs: uniqSorted(langs),
    expected: uniqSorted(expected),
    applicable,
  }
}

export function buildArticleCoverage(input: CoverageInput): ArticleCoverage {
  // `resolveArticleForSummary` and the insights equivalent both throw on a
  // page, so those two genuinely cannot run for one. TTS has no such guard —
  // its `loadDocument` takes any document — and translation covers pages by
  // design.
  const summarisable = input.type !== CollectionRefTypes.Page

  const sourceLang = input.metaLang ?? input.translationSourceLangs[0] ?? null

  return {
    sourceLang,
    summary: capability(
      input.summaryLangs,
      input.configured.summary,
      summarisable,
    ),
    insights: capability(
      input.insightsLangs,
      input.configured.insights,
      summarisable,
    ),
    // Translating an article back into its own language is not a gap.
    translation: capability(
      input.translationLangs,
      input.configured.translation.filter((lang) => lang !== sourceLang),
      true,
    ),
    // TTS has no configured target list and cannot narrate text that was never
    // written: its expectation is the source language plus whatever
    // translations actually exist.
    tts: capability(
      input.ttsLangs,
      [sourceLang, ...input.translationLangs],
      true,
    ),
  }
}

export function capabilityGaps(coverage: CapabilityCoverage): string[] {
  if (!coverage.applicable) return []
  const have = new Set(coverage.langs)
  return coverage.expected.filter((lang) => !have.has(lang))
}

export function countGaps(coverage: ArticleCoverage): number {
  return AI_OVERVIEW_CAPABILITIES.reduce(
    (total, key: AiOverviewCapability) =>
      total + capabilityGaps(coverage[key]).length,
    0,
  )
}
