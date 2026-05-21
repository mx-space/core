import {
  EntryTranslationSchema,
  InsightsMetaSchema,
  InteractionMetaSchema,
  ResponseMetaSchema,
} from '~/common/response/meta.types'

describe('meta.types schemas', () => {
  test('EntryTranslationSchema rejects unknown keys (strict)', () => {
    expect(
      EntryTranslationSchema.safeParse({ article: { isTranslated: true } })
        .success,
    ).toBe(true)
    expect(EntryTranslationSchema.safeParse({ '123': {} }).success).toBe(false)
  })

  test('InteractionMetaSchema rejects unknown keys (strict)', () => {
    expect(InteractionMetaSchema.safeParse({ isLiked: true }).success).toBe(
      true,
    )
    expect(InteractionMetaSchema.safeParse({ '123': {} }).success).toBe(false)
  })

  test('translation resolves a single EntryTranslation', () => {
    const parsed = ResponseMetaSchema.parse({
      translation: { article: { isTranslated: true, title: 'Hi' } },
    })

    expect(parsed.translation).toEqual({
      article: { isTranslated: true, title: 'Hi' },
    })
  })

  test('translation resolves an id-keyed map of EntryTranslation', () => {
    const parsed = ResponseMetaSchema.parse({
      translation: {
        '1': { article: { isTranslated: true } },
        '2': { fields: { 'category.name': 'News' } },
      },
    })

    expect(parsed.translation).toEqual({
      '1': { article: { isTranslated: true } },
      '2': { fields: { 'category.name': 'News' } },
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
})
