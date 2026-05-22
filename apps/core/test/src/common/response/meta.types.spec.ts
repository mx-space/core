import {
  ArticleTranslationSchema,
  EntryTranslationSchema,
  InsightsMetaSchema,
  InteractionMetaSchema,
  ResponseMetaSchema,
} from '~/common/response/meta.types'

describe('ArticleTranslationSchema', () => {
  it('parses a valid slim payload', () => {
    const result = ArticleTranslationSchema.safeParse({
      isTranslated: true,
      sourceLang: 'zh',
      targetLang: 'en',
      translatedAt: new Date(),
      model: 'claude-haiku-4-5',
      availableTranslations: ['ko', 'ja', 'en'],
    })
    expect(result.success).toBe(true)
  })

  const removedFields = [
    'title',
    'text',
    'subtitle',
    'summary',
    'tags',
    'content',
    'contentFormat',
  ] as const

  for (const field of removedFields) {
    it(`rejects removed field: ${field}`, () => {
      const payload: Record<string, unknown> = {
        isTranslated: true,
        sourceLang: 'zh',
        [field]: field === 'tags' ? ['a'] : 'some value',
      }
      expect(ArticleTranslationSchema.safeParse(payload).success).toBe(false)
    })
  }
})

describe('EntryTranslationSchema', () => {
  it('parses a valid entry with article', () => {
    expect(
      EntryTranslationSchema.safeParse({
        article: { isTranslated: true, sourceLang: 'zh' },
      }).success,
    ).toBe(true)
  })

  it('rejects unknown top-level key "fields"', () => {
    expect(
      EntryTranslationSchema.safeParse({
        article: { isTranslated: true },
        fields: { title: 'x' },
      }).success,
    ).toBe(false)
  })

  it('rejects arbitrary unknown top-level keys (strict)', () => {
    expect(EntryTranslationSchema.safeParse({ '123': {} }).success).toBe(false)
  })
})

describe('meta.types schemas', () => {
  test('InteractionMetaSchema rejects unknown keys (strict)', () => {
    expect(InteractionMetaSchema.safeParse({ isLiked: true }).success).toBe(
      true,
    )
    expect(InteractionMetaSchema.safeParse({ '123': {} }).success).toBe(false)
  })

  test('translation resolves a single EntryTranslation', () => {
    const parsed = ResponseMetaSchema.parse({
      translation: { article: { isTranslated: true, sourceLang: 'zh' } },
    })

    expect(parsed.translation).toEqual({
      article: { isTranslated: true, sourceLang: 'zh' },
    })
  })

  test('translation resolves an id-keyed map of EntryTranslation', () => {
    const parsed = ResponseMetaSchema.parse({
      translation: {
        '1': { article: { isTranslated: true } },
        '2': { article: { isTranslated: false, sourceLang: 'zh' } },
      },
    })

    expect(parsed.translation).toEqual({
      '1': { article: { isTranslated: true } },
      '2': { article: { isTranslated: false, sourceLang: 'zh' } },
    })
  })

  test('interaction resolves both a single value and an id-keyed map', () => {
    expect(
      ResponseMetaSchema.parse({ interaction: { isLiked: true } }).interaction,
    ).toEqual({ isLiked: true })

    expect(
      ResponseMetaSchema.parse({
        interaction: { '1': { isLiked: true }, '2': { isLiked: false } },
      }).interaction,
    ).toEqual({ '1': { isLiked: true }, '2': { isLiked: false } })
  })

  test('enrichments accepts a url-keyed record', () => {
    const parsed = ResponseMetaSchema.parse({
      enrichments: {
        'https://example.com': {
          title: 'Example',
          url: 'https://example.com',
          category: 'website',
        },
      },
    })

    expect(parsed.enrichments?.['https://example.com']?.category).toBe(
      'website',
    )
  })

  test('ResponseMetaSchema accepts insights with hasInLocale', () => {
    const parsed = ResponseMetaSchema.parse({
      insights: { hasInLocale: true },
    })

    expect(parsed.insights).toEqual({ hasInLocale: true })
  })

  test('ResponseMetaSchema accepts insights with hasInLocale false', () => {
    const parsed = ResponseMetaSchema.parse({
      insights: { hasInLocale: false },
    })

    expect(parsed.insights).toEqual({ hasInLocale: false })
  })

  test('InsightsMetaSchema rejects unknown keys (strict)', () => {
    expect(InsightsMetaSchema.safeParse({ hasInLocale: true }).success).toBe(
      true,
    )
    expect(
      InsightsMetaSchema.safeParse({ hasInLocale: true, extra: 1 }).success,
    ).toBe(false)
  })

  test('ResponseMetaSchema.parse succeeds for slim article translation', () => {
    const result = ResponseMetaSchema.safeParse({
      translation: {
        abc: { article: { isTranslated: true, sourceLang: 'zh' } },
      },
    })
    expect(result.success).toBe(true)
  })

  test('ResponseMetaSchema.parse throws when article contains removed field title', () => {
    const result = ResponseMetaSchema.safeParse({
      translation: {
        abc: { article: { isTranslated: true, title: 'x' } },
      },
    })
    expect(result.success).toBe(false)
  })
})
