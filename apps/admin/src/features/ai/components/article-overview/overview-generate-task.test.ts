import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AiOverviewDetail } from '~/api/ai-overview'

import { buildGenerateTask } from './overview-generate-task'

vi.mock('~/api/ai', () => ({
  createInsightsTask: vi.fn(),
  createInsightsTranslationTask: vi.fn(),
  createSummaryTask: vi.fn(),
  createTranslationTask: vi.fn(),
  createTtsTask: vi.fn(),
}))

const api = await import('~/api/ai')

const detailWith = (
  insights: Array<{ lang: string; isTranslation: boolean }>,
) =>
  ({
    assets: { insights },
  }) as unknown as AiOverviewDetail

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildGenerateTask', () => {
  it('keeps every requested language for a summary retry', () => {
    buildGenerateTask('summary', ['en', 'ja'], '42', detailWith([]), true)

    expect(api.createSummaryTask).toHaveBeenCalledWith({
      force: true,
      refId: '42',
      targetLanguages: ['en', 'ja'],
    })
  })

  it('sends no language list when the task ran on the configured targets', () => {
    buildGenerateTask('translation', undefined, '42', detailWith([]), true)

    expect(api.createTranslationTask).toHaveBeenCalledWith({
      force: true,
      refId: '42',
      targetLanguages: undefined,
    })
  })

  it('passes a tts retry its full language list', () => {
    buildGenerateTask('tts', ['zh', 'en'], '42', detailWith([]), true)

    expect(api.createTtsTask).toHaveBeenCalledWith({
      force: true,
      langs: ['zh', 'en'],
      refId: '42',
    })
  })

  it('carries the requested language on the base insights task when no base row exists', () => {
    buildGenerateTask('insights', ['en'], '42', detailWith([]), false)

    expect(api.createInsightsTask).toHaveBeenCalledWith({
      force: false,
      refId: '42',
      targetLanguages: ['en'],
    })
    expect(api.createInsightsTranslationTask).not.toHaveBeenCalled()
  })

  it('translates from the existing base row and forwards force', () => {
    const detail = detailWith([{ lang: 'zh', isTranslation: false }])

    buildGenerateTask('insights', ['en'], '42', detail, true)

    expect(api.createInsightsTranslationTask).toHaveBeenCalledWith({
      force: true,
      refId: '42',
      targetLang: 'en',
    })
  })

  it('regenerates the base row when the requested language is its own', () => {
    const detail = detailWith([{ lang: 'zh', isTranslation: false }])

    buildGenerateTask('insights', ['zh'], '42', detail, true)

    expect(api.createInsightsTask).toHaveBeenCalledWith({
      force: true,
      refId: '42',
    })
  })

  it('regenerates the base row when a retry carries no language at all', () => {
    const detail = detailWith([{ lang: 'zh', isTranslation: false }])

    buildGenerateTask('insights', undefined, '42', detail, true)

    expect(api.createInsightsTask).toHaveBeenCalledWith({
      force: true,
      refId: '42',
    })
  })
})
