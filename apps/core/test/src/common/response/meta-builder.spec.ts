import {
  type EntryTranslation,
  type InteractionMeta,
  ResponseMetaSchema,
} from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'

describe('MetaObjectBuilder', () => {
  test('empty build produces an empty object that validates', () => {
    const meta = new MetaObjectBuilder().build()

    expect(meta).toEqual({})
    expect(ResponseMetaSchema.safeParse(meta).success).toBe(true)
  })

  test('pagination sets the pagination key only', () => {
    const meta = new MetaObjectBuilder()
      .pagination({ page: 1, size: 10, total: 42, total_pages: 5 })
      .build()

    expect(meta.pagination).toEqual({
      page: 1,
      size: 10,
      total: 42,
      total_pages: 5,
    })
    expect(Object.keys(meta)).toEqual(['pagination'])
  })

  test('pagination normalizes repository pagination shape', () => {
    const meta = new MetaObjectBuilder()
      .pagination({
        currentPage: 2,
        size: 10,
        total: 42,
        totalPage: 5,
        hasNextPage: true,
        hasPrevPage: true,
      })
      .build()

    expect(meta.pagination).toEqual({
      page: 2,
      size: 10,
      total: 42,
      total_pages: 5,
    })
  })

  test('view sets the view key only', () => {
    const meta = new MetaObjectBuilder().view('card').build()

    expect(meta.view).toBe('card')
    expect(Object.keys(meta)).toEqual(['view'])
  })

  test('translation accepts a single EntryTranslation', () => {
    const entry: EntryTranslation = {
      article: { is_translated: true, title: 'Hello', target_lang: 'en' },
      fields: { 'category.name': 'News' },
    }
    const meta = new MetaObjectBuilder().translation(entry).build()

    expect(meta.translation).toEqual(entry)
  })

  test('translation normalizes a Map into an id-keyed record', () => {
    const map = new Map<string, EntryTranslation>([
      ['1', { article: { is_translated: true, title: 'A' } }],
      ['2', { article: { is_translated: false } }],
    ])
    const meta = new MetaObjectBuilder().translation(map).build()

    expect(meta.translation).toEqual({
      1: { article: { is_translated: true, title: 'A' } },
      2: { article: { is_translated: false } },
    })
  })

  test('interaction accepts a single InteractionMeta', () => {
    const interaction: InteractionMeta = { is_liked: true, like_count: 3 }
    const meta = new MetaObjectBuilder().interaction(interaction).build()

    expect(meta.interaction).toEqual(interaction)
  })

  test('interaction normalizes a Map into an id-keyed record', () => {
    const map = new Map<string, InteractionMeta>([
      ['1', { is_liked: true }],
      ['2', { is_liked: false }],
    ])
    const meta = new MetaObjectBuilder().interaction(map).build()

    expect(meta.interaction).toEqual({
      1: { is_liked: true },
      2: { is_liked: false },
    })
  })

  test('enrichments sets a url-keyed record', () => {
    const meta = new MetaObjectBuilder()
      .enrichments({
        'https://example.com': {
          title: 'Example',
          url: 'https://example.com',
          category: 'website',
        },
      })
      .build()

    expect(meta.enrichments?.['https://example.com']?.title).toBe('Example')
  })

  test('related sets an array of refs', () => {
    const meta = new MetaObjectBuilder()
      .related([{ id: '1', title: 'Related post' }])
      .build()

    expect(meta.related).toEqual([{ id: '1', title: 'Related post' }])
  })

  test('articles sets a ref map', () => {
    const meta = new MetaObjectBuilder()
      .articles({
        1: { id: '1', title: 'Article', type: 'post' },
      })
      .build()

    expect(meta.articles).toEqual({
      1: { id: '1', title: 'Article', type: 'post' },
    })
  })

  test('chained builders compose all keys and validate', () => {
    const meta = new MetaObjectBuilder()
      .view('detail')
      .pagination({ page: 2, size: 20, total: 100, total_pages: 5 })
      .interaction({ is_liked: false })
      .build()

    expect(ResponseMetaSchema.safeParse(meta).success).toBe(true)
    expect(meta.view).toBe('detail')
    expect(meta.pagination?.page).toBe(2)
    expect(meta.interaction).toEqual({ is_liked: false })
  })

  test('build throws when a value violates the schema', () => {
    const builder = new MetaObjectBuilder().pagination({
      page: -1,
      size: 10,
      total: 0,
      total_pages: 0,
    })

    expect(() => builder.build()).toThrow()
  })

  test('insights sets the insights key', () => {
    const meta = new MetaObjectBuilder()
      .insights({ has_in_locale: true })
      .build()

    expect(meta.insights).toEqual({ has_in_locale: true })
    expect(Object.keys(meta)).toEqual(['insights'])
  })
})
