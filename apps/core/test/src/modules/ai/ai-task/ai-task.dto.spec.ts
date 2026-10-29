import { describe, expect, it } from 'vitest'

import { MAX_LANGS_PER_TASK } from '~/modules/ai/ai.constants'
import {
  CreateInsightsTaskSchema,
  CreateInsightsTranslationTaskSchema,
} from '~/modules/ai/ai-insights/ai-insights.schema'
import {
  CreateSummaryTaskSchema,
  CreateSummaryTranslationTaskSchema,
  CreateTranslationAllTaskSchema,
  CreateTranslationBatchTaskSchema,
  CreateTranslationTaskSchema,
} from '~/modules/ai/ai-task/ai-task.dto'

const eightLangs = ['en', 'ja', 'ko', 'fr', 'de', 'es', 'it', 'pt']
const nineLangs = [...eightLangs, 'ru']

describe('task target language validation', () => {
  it('canonicalizes target languages', () => {
    expect(
      CreateSummaryTaskSchema.parse({
        refId: 'article-1',
        targetLanguages: ['zh', 'zh_TW'],
      }).targetLanguages,
    ).toEqual(['zh-CN', 'zh-TW'])
    expect(
      CreateSummaryTranslationTaskSchema.parse({
        refId: 'article-1',
        targetLang: 'en',
      }).targetLang,
    ).toBe('en-US')
    expect(
      CreateInsightsTranslationTaskSchema.parse({
        refId: 'article-1',
        targetLang: 'ja',
      }).targetLang,
    ).toBe('ja-JP')
  })

  it('rejects unknown target languages', () => {
    for (const schema of [
      CreateSummaryTaskSchema,
      CreateTranslationTaskSchema,
      CreateInsightsTaskSchema,
      CreateTranslationBatchTaskSchema,
    ]) {
      expect(
        schema.safeParse({
          refId: 'article-1',
          refIds: ['article-1'],
          targetLanguages: ['jp'],
        }).success,
      ).toBe(false)
    }
    expect(
      CreateTranslationAllTaskSchema.safeParse({ targetLanguages: ['jp'] })
        .success,
    ).toBe(false)
  })
})

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

  it('rejects a blank or whitespace-only target language', () => {
    expect(
      CreateSummaryTaskSchema.safeParse({
        refId: 'article-1',
        targetLanguages: [''],
      }).success,
    ).toBe(false)
    expect(
      CreateSummaryTaskSchema.safeParse({
        refId: 'article-1',
        targetLanguages: ['   '],
      }).success,
    ).toBe(false)
  })
})

describe('CreateSummaryTranslationTaskSchema', () => {
  it('accepts a single non-blank target language', () => {
    expect(
      CreateSummaryTranslationTaskSchema.safeParse({
        refId: 'article-1',
        targetLang: 'en',
      }).success,
    ).toBe(true)
  })

  it('rejects a blank target language', () => {
    expect(
      CreateSummaryTranslationTaskSchema.safeParse({
        refId: 'article-1',
        targetLang: '   ',
      }).success,
    ).toBe(false)
  })
})

describe('CreateInsightsTaskSchema', () => {
  it('accepts targetLanguages at the max of 8', () => {
    expect(
      CreateInsightsTaskSchema.safeParse({
        refId: 'article-1',
        targetLanguages: eightLangs,
      }).success,
    ).toBe(true)
  })

  it('rejects targetLanguages of 9', () => {
    expect(
      CreateInsightsTaskSchema.safeParse({
        refId: 'article-1',
        targetLanguages: nineLangs,
      }).success,
    ).toBe(false)
  })

  it('rejects a blank or whitespace-only target language', () => {
    expect(
      CreateInsightsTaskSchema.safeParse({
        refId: 'article-1',
        targetLanguages: [''],
      }).success,
    ).toBe(false)
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

  it('rejects a blank or whitespace-only target language', () => {
    expect(
      CreateTranslationTaskSchema.safeParse({
        refId: 'article-1',
        targetLanguages: [''],
      }).success,
    ).toBe(false)
    expect(
      CreateTranslationTaskSchema.safeParse({
        refId: 'article-1',
        targetLanguages: ['   '],
      }).success,
    ).toBe(false)
  })
})
