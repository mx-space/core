import { AISchema, SeoSchema } from '~/modules/configs/configs.schema'

describe('SeoSchema i18n overlay', () => {
  test('accepts a partial per-locale overlay', () => {
    const result = SeoSchema.safeParse({
      i18n: {
        en: { description: 'x', keywords: ['a'] },
      },
    })

    expect(result.success).toBe(true)
    expect(result.data?.i18n).toEqual({
      en: { description: 'x', keywords: ['a'] },
    })
  })

  test('rejects a locale key that is not exactly 2 characters', () => {
    const result = SeoSchema.safeParse({
      i18n: {
        eng: { title: 'x' },
      },
    })

    expect(result.success).toBe(false)
  })

  test('rejects an empty-string title in an overlay', () => {
    const result = SeoSchema.safeParse({
      i18n: {
        en: { title: '' },
      },
    })

    expect(result.success).toBe(false)
  })
})

describe('AISchema target languages', () => {
  const fields = [
    'summaryTargetLanguages',
    'translationTargetLanguages',
    'insightsTargetLanguages',
  ] as const

  test.each(fields)('%s canonicalizes and dedupes tags', (field) => {
    const result = AISchema.shape[field].safeParse([
      'en',
      'zh-TW',
      'zh',
      'zh-CN',
    ])

    expect(result.success).toBe(true)
    expect(result.data).toEqual(['en-US', 'zh-TW', 'zh-CN'])
  })

  test.each(fields)('%s rejects non-standard aliases', (field) => {
    expect(AISchema.shape[field].safeParse(['jp']).success).toBe(false)
    expect(AISchema.shape[field].safeParse(['english']).success).toBe(false)
  })
})
