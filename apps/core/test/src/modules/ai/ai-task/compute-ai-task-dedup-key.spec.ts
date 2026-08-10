import { describe, expect, it } from 'vitest'

import {
  AITaskType,
  computeAITaskDedupKey,
  type InsightsTaskPayload,
  type InsightsTranslationTaskPayload,
  type SummaryTaskPayload,
  type TranslationTaskPayload,
} from '~/modules/ai/ai-task/ai-task.types'

describe('computeAITaskDedupKey — force bit', () => {
  it('gives Summary a different dedup key for force vs incremental', () => {
    const base: SummaryTaskPayload = { refId: '1', targetLanguages: ['en'] }

    const incKey = computeAITaskDedupKey(AITaskType.Summary, base)
    const forceKey = computeAITaskDedupKey(AITaskType.Summary, {
      ...base,
      force: true,
    })

    expect(incKey).not.toBe(forceKey)
    expect(incKey).toBe('1:inc:en')
    expect(forceKey).toBe('1:force:en')
  })

  it('gives Translation a different dedup key for force vs incremental', () => {
    const base: TranslationTaskPayload = {
      refId: '1',
      targetLanguages: ['en', 'ja'],
    }

    const incKey = computeAITaskDedupKey(AITaskType.Translation, base)
    const forceKey = computeAITaskDedupKey(AITaskType.Translation, {
      ...base,
      force: true,
    })

    expect(incKey).not.toBe(forceKey)
    expect(incKey).toBe('1:inc:en,ja')
    expect(forceKey).toBe('1:force:en,ja')
  })

  it('gives Insights a different dedup key for force vs incremental', () => {
    const base: InsightsTaskPayload = { refId: '1' }

    const incKey = computeAITaskDedupKey(AITaskType.Insights, base)
    const forceKey = computeAITaskDedupKey(AITaskType.Insights, {
      ...base,
      force: true,
    })

    expect(incKey).not.toBe(forceKey)
    expect(incKey).toBe('1:inc:')
    expect(forceKey).toBe('1:force:')
  })

  it('gives SummaryTranslation a per-language key with force folded in, mirroring InsightsTranslation', () => {
    const base = {
      refId: '1',
      sourceSummaryId: '9',
      targetLang: 'en',
    }

    const incKey = computeAITaskDedupKey(AITaskType.SummaryTranslation, base)
    const forceKey = computeAITaskDedupKey(AITaskType.SummaryTranslation, {
      ...base,
      force: true,
    })

    expect(incKey).toBe('1:en:inc')
    expect(forceKey).toBe('1:en:force')
  })

  it('gives InsightsTranslation a different dedup key for force vs incremental, so a forced regeneration is not swallowed by a pending plain task', () => {
    const base: InsightsTranslationTaskPayload = {
      refId: '1',
      sourceInsightsId: '9',
      targetLang: 'en',
    }

    const incKey = computeAITaskDedupKey(AITaskType.InsightsTranslation, base)
    const forceKey = computeAITaskDedupKey(AITaskType.InsightsTranslation, {
      ...base,
      force: true,
    })

    expect(incKey).toBe('1:en:inc')
    expect(forceKey).toBe('1:en:force')
  })

  it('keeps a requested insights target language out of the plain key, so two targets queue as two tasks', () => {
    const base: InsightsTaskPayload = { refId: '1' }

    expect(
      computeAITaskDedupKey(AITaskType.Insights, {
        ...base,
        targetLanguages: ['en'],
      }),
    ).not.toBe(
      computeAITaskDedupKey(AITaskType.Insights, {
        ...base,
        targetLanguages: ['ja'],
      }),
    )
  })

  it('canonicalizes a requested insights target language, so jp and ja dedupe together', () => {
    expect(
      computeAITaskDedupKey(AITaskType.Insights, {
        refId: '1',
        targetLanguages: ['jp'],
      }),
    ).toBe(
      computeAITaskDedupKey(AITaskType.Insights, {
        refId: '1',
        targetLanguages: ['ja'],
      }),
    )
  })
})

describe('computeAITaskDedupKey — target language normalization', () => {
  it('gives Summary the same dedup key for zh-CN and zh, since generation now produces the same result', () => {
    const regional = computeAITaskDedupKey(AITaskType.Summary, {
      refId: '1',
      targetLanguages: ['zh-CN'],
    })
    const canonical = computeAITaskDedupKey(AITaskType.Summary, {
      refId: '1',
      targetLanguages: ['zh'],
    })

    expect(regional).toBe(canonical)
    expect(regional).toBe('1:inc:zh')
  })

  it('gives Translation the same dedup key for zh-CN and zh, since generation now produces the same result', () => {
    const regional = computeAITaskDedupKey(AITaskType.Translation, {
      refId: '1',
      targetLanguages: ['zh-CN'],
    })
    const canonical = computeAITaskDedupKey(AITaskType.Translation, {
      refId: '1',
      targetLanguages: ['zh'],
    })

    expect(regional).toBe(canonical)
    expect(regional).toBe('1:inc:zh')
  })
})
