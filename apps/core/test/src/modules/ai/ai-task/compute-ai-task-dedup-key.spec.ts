import { describe, expect, it } from 'vitest'

import {
  AITaskType,
  computeAITaskDedupKey,
  type InsightsTaskPayload,
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
    expect(incKey).toBe('1:inc')
    expect(forceKey).toBe('1:force')
  })
})
