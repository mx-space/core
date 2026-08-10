import { describe, expect, it } from 'vitest'

import { MAX_LANGS_PER_TASK } from '~/modules/ai/ai.constants'
import {
  CreateSummaryTaskSchema,
  CreateTranslationTaskSchema,
} from '~/modules/ai/ai-task/ai-task.dto'

const eightLangs = Array.from({ length: 8 }, (_, i) => `lang${i}`)
const nineLangs = Array.from({ length: 9 }, (_, i) => `lang${i}`)

describe('CreateSummaryTaskSchema', () => {
  it('accepts targetLanguages at the max of 8', () => {
    const result = CreateSummaryTaskSchema.safeParse({
      refId: 'article-1',
      targetLanguages: eightLangs,
    })
    expect(result.success).toBe(true)
  })

  it('rejects targetLanguages of 9', () => {
    const result = CreateSummaryTaskSchema.safeParse({
      refId: 'article-1',
      targetLanguages: nineLangs,
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateTranslationTaskSchema', () => {
  it('accepts targetLanguages at the max of 8', () => {
    const result = CreateTranslationTaskSchema.safeParse({
      refId: 'article-1',
      targetLanguages: eightLangs,
    })
    expect(result.success).toBe(true)
  })

  it('rejects targetLanguages of 9', () => {
    const result = CreateTranslationTaskSchema.safeParse({
      refId: 'article-1',
      targetLanguages: nineLangs,
    })
    expect(result.success).toBe(false)
  })

  it('shares the max with MAX_LANGS_PER_TASK', () => {
    expect(eightLangs.length).toBe(MAX_LANGS_PER_TASK)
  })
})
