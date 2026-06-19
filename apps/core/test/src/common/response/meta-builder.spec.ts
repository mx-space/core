import {
  BaseResponseMetaSchema,
  type EntryTranslation,
  type InteractionMeta,
} from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { NoteMetaBuilder } from '~/modules/note/note-meta-builder'
import { PostMetaBuilder } from '~/modules/post/post-meta-builder'

describe('MetaObjectBuilder', () => {
  test('empty build produces an empty object that validates', () => {
    const meta = new MetaObjectBuilder().build()

    expect(meta).toEqual({})
    expect(BaseResponseMetaSchema.safeParse(meta).success).toBe(true)
  })

  test('pagination sets the pagination key only', () => {
    const meta = new MetaObjectBuilder()
      .pagination({ page: 1, size: 10, total: 42, totalPages: 5 })
      .build()

    expect(meta.pagination).toEqual({
      page: 1,
      size: 10,
      total: 42,
      totalPages: 5,
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
      totalPages: 5,
    })
  })

  test('view sets the view key only', () => {
    const meta = new MetaObjectBuilder().view('card').build()

    expect(meta.view).toBe('card')
    expect(Object.keys(meta)).toEqual(['view'])
  })

  test('translation accepts a single EntryTranslation', () => {
    const entry: EntryTranslation = {
      article: { isTranslated: true, sourceLang: 'zh', targetLang: 'en' },
    }
    const meta = new MetaObjectBuilder().translation(entry).build()

    expect(meta.translation).toEqual(entry)
  })

  test('translation normalizes a Map into an id-keyed record', () => {
    const map = new Map<string, EntryTranslation>([
      ['1', { article: { isTranslated: true, sourceLang: 'zh' } }],
      ['2', { article: { isTranslated: false } }],
    ])
    const meta = new MetaObjectBuilder().translation(map).build()

    expect(meta.translation).toEqual({
      1: { article: { isTranslated: true, sourceLang: 'zh' } },
      2: { article: { isTranslated: false } },
    })
  })

  test('interaction accepts a single InteractionMeta', () => {
    const interaction: InteractionMeta = { isLiked: true, likeCount: 3 }
    const meta = new MetaObjectBuilder().interaction(interaction).build()

    expect(meta.interaction).toEqual(interaction)
  })

  test('interaction normalizes a Map into an id-keyed record', () => {
    const map = new Map<string, InteractionMeta>([
      ['1', { isLiked: true }],
      ['2', { isLiked: false }],
    ])
    const meta = new MetaObjectBuilder().interaction(map).build()

    expect(meta.interaction).toEqual({
      1: { isLiked: true },
      2: { isLiked: false },
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

  test('PostMetaBuilder.related sets an array of refs', () => {
    const meta = new PostMetaBuilder()
      .related([{ id: '1', title: 'Related post' }])
      .build()

    expect(meta.related).toEqual([{ id: '1', title: 'Related post' }])
  })

  test('PostMetaBuilder.articles sets a ref map', () => {
    const meta = new PostMetaBuilder()
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
      .pagination({ page: 2, size: 20, total: 100, totalPages: 5 })
      .interaction({ isLiked: false })
      .build()

    expect(BaseResponseMetaSchema.safeParse(meta).success).toBe(true)
    expect(meta.view).toBe('detail')
    expect(meta.pagination?.page).toBe(2)
    expect(meta.interaction).toEqual({ isLiked: false })
  })

  test('build throws when a value violates the schema', () => {
    const builder = new MetaObjectBuilder().pagination({
      page: -1,
      size: 10,
      total: 0,
      totalPages: 0,
    })

    expect(() => builder.build()).toThrow()
  })

  test('PostMetaBuilder.insights sets the insights key', () => {
    const meta = new PostMetaBuilder().insights({ hasInLocale: true }).build()

    expect(meta.insights).toEqual({ hasInLocale: true })
    expect(Object.keys(meta)).toEqual(['insights'])
  })

  test('NoteMetaBuilder.summary sets the summary key', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z')
    const meta = new NoteMetaBuilder()
      .summary({ id: 's1', text: 'note summary', lang: 'en', createdAt })
      .build()

    expect(meta.summary).toEqual({
      id: 's1',
      text: 'note summary',
      lang: 'en',
      createdAt,
    })
  })

  test('PostMetaBuilder.skills sets a skill bundle list', () => {
    const bundle = {
      id: '1',
      name: 'my-skill',
      description: 'desc',
      rawUrl: '/s/sk/my-skill/SKILL.md',
      assets: [],
    }
    const meta = new PostMetaBuilder().skills([bundle]).build()

    expect(meta.skills).toEqual([bundle])
  })
})
