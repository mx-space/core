import { describe, expect, it } from 'vitest'

import type { AiOverviewDetail } from '~/api/ai-overview'

import { buildAssetRows, firstAnchorIds } from './asset-rows'

function detail(
  assets: Partial<AiOverviewDetail['assets']> = {},
): AiOverviewDetail {
  return {
    activeTasks: [],
    article: { id: '1', title: 'x', type: 'Post' },
    assets: { summary: [], insights: [], translation: [], tts: [], ...assets },
    cost: {
      byResourceType: {} as AiOverviewDetail['cost']['byResourceType'],
      models: [],
      total: {
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costTotalUsd: 0,
        generationCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    },
    coverage: {
      sourceLang: 'zh',
      summary: { langs: [], expected: [], applicable: true },
      insights: { langs: [], expected: [], applicable: true },
      translation: { langs: [], expected: [], applicable: true },
      tts: { langs: [], expected: [], applicable: true },
    },
  }
}

describe('buildAssetRows', () => {
  it('orders rows summary, insights, translation, tts', () => {
    const rows = buildAssetRows(
      detail({
        summary: [
          {
            createdAt: 'a',
            id: 's1',
            isTranslation: false,
            lang: 'zh',
            sourceLang: 'zh',
            summary: 'sum',
          },
        ],
        insights: [
          {
            content: 'line',
            createdAt: 'a',
            id: 'i1',
            isTranslation: false,
            lang: 'zh',
            sourceLang: null,
          },
        ],
        translation: [
          {
            aiModel: null,
            createdAt: 'a',
            id: 't1',
            lang: 'en',
            sourceLang: 'zh',
            updatedAt: null,
          },
        ],
        tts: [
          {
            charCount: 1200,
            createdAt: 'a',
            durationMs: 65_000,
            id: 'v1',
            isTranslation: false,
            lang: 'zh',
            updatedAt: null,
          },
        ],
      }),
    )

    expect(rows.map((row) => row.capability)).toEqual([
      'summary',
      'insights',
      'translation',
      'tts',
    ])
  })

  it('previews a translation as a language pair and tts as duration plus chars', () => {
    const rows = buildAssetRows(
      detail({
        translation: [
          {
            aiModel: null,
            createdAt: 'a',
            id: 't1',
            lang: 'en',
            sourceLang: 'zh',
            updatedAt: null,
          },
        ],
        tts: [
          {
            charCount: 1200,
            createdAt: 'a',
            durationMs: 65_000,
            id: 'v1',
            isTranslation: false,
            lang: 'zh',
            updatedAt: null,
          },
        ],
      }),
    )

    expect(rows[0].preview).toBe('zh → en')
    expect(rows[1].preview).toBe('1:05 · 1,200 chars')
  })

  it('takes the first non-blank line of insights content', () => {
    const rows = buildAssetRows(
      detail({
        insights: [
          {
            content: '\n\n  first point  \nsecond',
            createdAt: 'a',
            id: 'i1',
            isTranslation: false,
            lang: 'zh',
            sourceLang: null,
          },
        ],
      }),
    )

    expect(rows[0].preview).toBe('first point')
  })

  it('omits duration from the tts preview when it is unknown', () => {
    const rows = buildAssetRows(
      detail({
        tts: [
          {
            charCount: 300,
            createdAt: 'a',
            durationMs: null,
            id: 'v1',
            isTranslation: false,
            lang: 'zh',
            updatedAt: null,
          },
        ],
      }),
    )

    expect(rows[0].preview).toBe('300 chars')
  })
})

describe('firstAnchorIds', () => {
  it('anchors a language to its newest row only', () => {
    const rows = buildAssetRows(
      detail({
        tts: [
          {
            charCount: 1,
            createdAt: 'newer',
            durationMs: null,
            id: 'new',
            isTranslation: false,
            lang: 'zh',
            updatedAt: null,
          },
          {
            charCount: 1,
            createdAt: 'older',
            durationMs: null,
            id: 'old',
            isTranslation: false,
            lang: 'zh',
            updatedAt: null,
          },
        ],
      }),
    )

    expect(firstAnchorIds(rows).get('tts:zh')).toBe('new')
  })
})
