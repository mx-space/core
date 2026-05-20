import {
  EntryTranslationSchema,
  InsightsMetaSchema,
  InteractionMetaSchema,
  ResponseMetaSchema,
} from '~/common/response/meta.types'

describe('meta.types schemas', () => {
  test('EntryTranslationSchema rejects unknown keys (strict)', () => {
    expect(
      EntryTranslationSchema.safeParse({ article: { is_translated: true } })
        .success,
    ).toBe(true)
    expect(EntryTranslationSchema.safeParse({ '123': {} }).success).toBe(false)
  })

  test('InteractionMetaSchema rejects unknown keys (strict)', () => {
    expect(InteractionMetaSchema.safeParse({ is_liked: true }).success).toBe(
      true,
    )
    expect(InteractionMetaSchema.safeParse({ '123': {} }).success).toBe(false)
  })

  test('translation resolves a single EntryTranslation', () => {
    const parsed = ResponseMetaSchema.parse({
      translation: { article: { is_translated: true, title: 'Hi' } },
    })

    expect(parsed.translation).toEqual({
      article: { is_translated: true, title: 'Hi' },
    })
  })

  test('translation resolves an id-keyed map of EntryTranslation', () => {
    const parsed = ResponseMetaSchema.parse({
      translation: {
        '1': { article: { is_translated: true } },
        '2': { fields: { 'category.name': 'News' } },
      },
    })

    expect(parsed.translation).toEqual({
      '1': { article: { is_translated: true } },
      '2': { fields: { 'category.name': 'News' } },
    })
  })

  test('interaction resolves both a single value and an id-keyed map', () => {
    expect(
      ResponseMetaSchema.parse({ interaction: { is_liked: true } }).interaction,
    ).toEqual({ is_liked: true })

    expect(
      ResponseMetaSchema.parse({
        interaction: { '1': { is_liked: true }, '2': { is_liked: false } },
      }).interaction,
    ).toEqual({ '1': { is_liked: true }, '2': { is_liked: false } })
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

  test('ResponseMetaSchema accepts insights with has_in_locale', () => {
    const parsed = ResponseMetaSchema.parse({
      insights: { has_in_locale: true },
    })

    expect(parsed.insights).toEqual({ has_in_locale: true })
  })

  test('ResponseMetaSchema accepts insights with has_in_locale false', () => {
    const parsed = ResponseMetaSchema.parse({
      insights: { has_in_locale: false },
    })

    expect(parsed.insights).toEqual({ has_in_locale: false })
  })

  test('InsightsMetaSchema rejects unknown keys (strict)', () => {
    expect(InsightsMetaSchema.safeParse({ has_in_locale: true }).success).toBe(
      true,
    )
    expect(
      InsightsMetaSchema.safeParse({ has_in_locale: true, extra: 1 }).success,
    ).toBe(false)
  })
})
