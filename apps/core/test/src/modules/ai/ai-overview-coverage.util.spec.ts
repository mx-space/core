import { describe, expect, it } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import type { CoverageInput } from '~/modules/ai/ai-overview/ai-overview-coverage.util'
import {
  buildArticleCoverage,
  capabilityGaps,
  countGaps,
} from '~/modules/ai/ai-overview/ai-overview-coverage.util'

function input(overrides: Partial<CoverageInput> = {}): CoverageInput {
  return {
    type: CollectionRefTypes.Post,
    metaLang: 'zh',
    summaryLangs: [],
    insightsLangs: [],
    translationLangs: [],
    translationSourceLangs: [],
    ttsLangs: [],
    configured: { summary: [], insights: [], translation: [] },
    ...overrides,
  }
}

describe('buildArticleCoverage', () => {
  it('takes expected languages from config for summary and insights', () => {
    const coverage = buildArticleCoverage(
      input({
        summaryLangs: ['zh'],
        insightsLangs: [],
        configured: {
          summary: ['zh', 'en'],
          insights: ['zh'],
          translation: [],
        },
      }),
    )

    expect(coverage.summary.expected).toEqual(['en', 'zh'])
    expect(capabilityGaps(coverage.summary)).toEqual(['en'])
    expect(capabilityGaps(coverage.insights)).toEqual(['zh'])
  })

  it('excludes the source language from translation expectations', () => {
    const coverage = buildArticleCoverage(
      input({
        metaLang: 'zh',
        translationLangs: ['en'],
        configured: {
          summary: [],
          insights: [],
          translation: ['zh', 'en', 'ja'],
        },
      }),
    )

    expect(coverage.translation.expected).toEqual(['en', 'ja'])
    expect(capabilityGaps(coverage.translation)).toEqual(['ja'])
  })

  describe('tts expectations', () => {
    it('is the source language plus the translations that exist', () => {
      const coverage = buildArticleCoverage(
        input({ metaLang: 'zh', translationLangs: ['en'], ttsLangs: ['zh'] }),
      )

      expect(coverage.tts.expected).toEqual(['en', 'zh'])
      expect(capabilityGaps(coverage.tts)).toEqual(['en'])
    })

    it('falls back to a translation row source language when meta.lang is absent', () => {
      const coverage = buildArticleCoverage(
        input({
          metaLang: null,
          translationLangs: ['en'],
          translationSourceLangs: ['ja', 'ja'],
        }),
      )

      expect(coverage.sourceLang).toBe('ja')
      expect(coverage.tts.expected).toEqual(['en', 'ja'])
    })

    it('degrades to existing translations when no source language is known', () => {
      const coverage = buildArticleCoverage(
        input({ metaLang: null, translationLangs: ['en'] }),
      )

      expect(coverage.sourceLang).toBeNull()
      expect(coverage.tts.expected).toEqual(['en'])
    })

    it('reports no gap for an article with neither source nor translations', () => {
      const coverage = buildArticleCoverage(input({ metaLang: null }))

      expect(coverage.tts.expected).toEqual([])
      expect(capabilityGaps(coverage.tts)).toEqual([])
    })
  })

  it('marks only summary and insights inapplicable for pages', () => {
    const coverage = buildArticleCoverage(
      input({
        type: CollectionRefTypes.Page,
        translationLangs: ['en'],
        configured: {
          summary: ['zh', 'en'],
          insights: ['zh'],
          translation: ['en', 'ja'],
        },
      }),
    )

    // Summary and insights throw on a page; TTS and translation do not.
    expect(coverage.summary.applicable).toBe(false)
    expect(coverage.insights.applicable).toBe(false)
    expect(coverage.tts.applicable).toBe(true)
    expect(coverage.translation.applicable).toBe(true)
  })

  it('excludes inapplicable capabilities from the gap count', () => {
    const configured = {
      summary: ['zh', 'en'],
      insights: ['zh'],
      translation: ['en', 'ja'],
    }

    const post = buildArticleCoverage(input({ configured }))
    const page = buildArticleCoverage(
      input({ type: CollectionRefTypes.Page, configured }),
    )

    // post: 2 summary + 1 insights + 2 translation + 1 tts (the source language)
    expect(countGaps(post)).toBe(6)
    // page: 2 translation + 1 tts
    expect(countGaps(page)).toBe(3)
  })

  it('deduplicates and sorts languages', () => {
    const coverage = buildArticleCoverage(
      input({
        summaryLangs: ['zh', 'en', 'zh'],
        configured: {
          summary: ['en', 'zh', 'en'],
          insights: [],
          translation: [],
        },
      }),
    )

    expect(coverage.summary.langs).toEqual(['en', 'zh'])
    expect(coverage.summary.expected).toEqual(['en', 'zh'])
    expect(capabilityGaps(coverage.summary)).toEqual([])
  })
})
