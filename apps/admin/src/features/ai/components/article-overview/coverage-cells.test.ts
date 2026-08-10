import { describe, expect, it } from 'vitest'

import type { ArticleCoverage, CapabilityCoverage } from '~/api/ai-overview'

import {
  capabilityDotState,
  coverageColumns,
  isGenerationPending,
  normaliseLangInput,
  resolveCell,
} from './coverage-cells'

const cell = (
  langs: string[],
  expected: string[],
  applicable = true,
): CapabilityCoverage => ({ langs, expected, applicable })

function coverage(overrides: Partial<ArticleCoverage> = {}): ArticleCoverage {
  return {
    sourceLang: 'zh',
    summary: cell([], []),
    insights: cell([], []),
    translation: cell([], []),
    tts: cell([], []),
    ...overrides,
  }
}

describe('coverageColumns', () => {
  it('unions every language across capabilities and sorts them', () => {
    const columns = coverageColumns(
      coverage({
        summary: cell(['zh'], ['en']),
        translation: cell(['ja'], ['ko']),
      }),
    )

    expect(columns).toEqual(['en', 'ja', 'ko', 'zh'])
  })

  it('includes the source language even when nothing references it', () => {
    expect(coverageColumns(coverage({ sourceLang: 'ja' }))).toEqual(['ja'])
  })

  it('merges manually added columns', () => {
    expect(
      coverageColumns(coverage({ sourceLang: null }), ['ko', 'en']),
    ).toEqual(['en', 'ko'])
  })
})

describe('normaliseLangInput', () => {
  it('accepts a bare code and lowercases it', () => {
    expect(normaliseLangInput(' EN ')).toBe('en')
  })

  it('strips a region subtag', () => {
    expect(normaliseLangInput('zh-CN')).toBe('zh')
  })

  it('rejects anything that is not a language code', () => {
    expect(normaliseLangInput('')).toBeNull()
    expect(normaliseLangInput('english')).toBeNull()
    expect(normaliseLangInput('e')).toBeNull()
    expect(normaliseLangInput('12')).toBeNull()
  })
})

describe('resolveCell', () => {
  it('marks the translation source column as source', () => {
    const value = coverage({ translation: cell(['en'], ['en']) })
    expect(resolveCell(value, 'translation', 'zh')).toBe('source')
  })

  it('marks an existing language as has', () => {
    const value = coverage({ summary: cell(['en'], ['en']) })
    expect(resolveCell(value, 'summary', 'en')).toBe('has')
  })

  it('marks an expected but absent language as gap', () => {
    const value = coverage({ summary: cell([], ['en']) })
    expect(resolveCell(value, 'summary', 'en')).toBe('gap')
  })

  it('marks an inapplicable capability as na even when expected', () => {
    const value = coverage({ summary: cell([], ['en'], false) })
    expect(resolveCell(value, 'summary', 'en')).toBe('na')
  })

  it('leaves an unexpected but supported language addable', () => {
    const value = coverage({
      summary: cell([], []),
      translation: cell(['ja'], ['ja']),
    })
    expect(resolveCell(value, 'summary', 'ja')).toBe('addable')
  })

  it('shows a queued gap as pending instead of inviting a second click', () => {
    const value = coverage({ summary: cell([], ['en']) })
    const tasks = [
      {
        capability: 'summary' as const,
        langs: ['en'],
        status: 'running',
        taskId: '1',
      },
    ]
    expect(resolveCell(value, 'summary', 'en', tasks)).toBe('pending')
  })

  it('keeps an existing asset as has while a regeneration runs', () => {
    const value = coverage({ summary: cell(['en'], ['en']) })
    const tasks = [
      {
        capability: 'summary' as const,
        langs: ['en'],
        status: 'running',
        taskId: '1',
      },
    ]
    expect(resolveCell(value, 'summary', 'en', tasks)).toBe('has')
  })
})

describe('isGenerationPending', () => {
  const task = (capability: 'summary' | 'tts', langs: string[]) => ({
    capability,
    langs,
    status: 'running',
    taskId: '1',
  })

  it('matches the named language only', () => {
    expect(
      isGenerationPending([task('summary', ['en'])], 'summary', 'en'),
    ).toBe(true)
    expect(
      isGenerationPending([task('summary', ['en'])], 'summary', 'zh'),
    ).toBe(false)
  })

  it('treats an unspecified language list as the whole capability', () => {
    expect(isGenerationPending([task('summary', [])], 'summary', 'ja')).toBe(
      true,
    )
  })

  it('does not leak across capabilities', () => {
    expect(isGenerationPending([task('tts', ['en'])], 'summary', 'en')).toBe(
      false,
    )
  })
})

describe('capabilityDotState', () => {
  it('reports full when every expected language exists', () => {
    const value = coverage({ summary: cell(['en', 'zh'], ['en', 'zh']) })
    expect(capabilityDotState(value, 'summary')).toBe('full')
  })

  it('reports partial when only some expected languages exist', () => {
    const value = coverage({ summary: cell(['en'], ['en', 'zh']) })
    expect(capabilityDotState(value, 'summary')).toBe('partial')
  })

  it('reports none when nothing expected exists', () => {
    const value = coverage({ summary: cell([], ['en']) })
    expect(capabilityDotState(value, 'summary')).toBe('none')
  })

  it('falls back to presence when there is no expectation', () => {
    expect(capabilityDotState(coverage({ tts: cell(['zh'], []) }), 'tts')).toBe(
      'full',
    )
    expect(capabilityDotState(coverage({ tts: cell([], []) }), 'tts')).toBe(
      'none',
    )
  })

  it('treats an inapplicable capability by presence, not expectation', () => {
    const value = coverage({ summary: cell([], ['en'], false) })
    expect(capabilityDotState(value, 'summary')).toBe('none')
  })
})
