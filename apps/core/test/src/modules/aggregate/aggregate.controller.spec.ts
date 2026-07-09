import { describe, expect, it, vi } from 'vitest'

import { AggregateController } from '~/modules/aggregate/aggregate.controller'

const NOW = new Date('2024-01-01')

const makeNote = (overrides: Record<string, unknown> = {}) => ({
  id: 'note1',
  title: 'Note Title',
  mood: 'Happy',
  weather: 'Sunny',
  createdAt: NOW,
  modifiedAt: null,
  ...overrides,
})

const makePost = (overrides: Record<string, unknown> = {}) => ({
  id: 'post1',
  title: 'Post Title',
  category: { id: 'cat1', name: 'Tech', slug: 'tech' },
  createdAt: NOW,
  modifiedAt: null,
  ...overrides,
})

const TRANSLATED_TITLE_RESULT = {
  isTranslated: true,
  title: 'Translated Title',
  text: '',
  sourceLang: 'zh',
  translationMeta: {
    sourceLang: 'zh',
    targetLang: 'en',
    translatedAt: new Date('2024-06-01'),
    model: 'claude-haiku-4-5',
  },
  availableTranslations: ['en'],
}

const UNTRANSLATED_RESULT = {
  isTranslated: false,
  title: 'Original Title',
  text: '',
  sourceLang: 'zh',
  availableTranslations: [],
}

const makeTranslationMeta = (_id: string) => ({
  article: {
    isTranslated: true,
    sourceLang: 'zh',
    targetLang: 'en',
    translatedAt: new Date('2024-06-01'),
    model: 'claude-haiku-4-5',
    availableTranslations: ['en'],
  },
})

const createController = (
  opts: {
    topActivityResult?: Record<string, any>
    latestResult?: any
    timelineResult?: Record<string, any>
    topArticlesResult?: any[]
    collectTranslations?: {
      results: Map<string, any>
      meta: Map<string, any>
    }
    entryMaps?: {
      entityMaps: Map<string, Map<string, string>>
      dictMaps: Map<string, Map<string, string>>
    }
  } = {},
) => {
  const defaultEntryMaps = {
    entityMaps: new Map<string, Map<string, string>>(),
    dictMaps: new Map<string, Map<string, string>>(),
  }

  const defaultCollect = {
    results: new Map<string, any>(),
    meta: new Map<string, any>(),
  }

  const aggregateService = {
    topActivity: vi.fn(
      async () =>
        opts.topActivityResult ?? {
          notes: [],
          posts: [],
          says: [],
          recently: [],
        },
    ),
    getLatest: vi.fn(async () => opts.latestResult ?? { posts: [], notes: [] }),
    getTimeline: vi.fn(
      async () => opts.timelineResult ?? { posts: [], notes: [] },
    ),
    getTopArticles: vi.fn(async () => opts.topArticlesResult ?? []),
    getSiteMapContent: vi.fn(async () => []),
    buildRssStructure: vi.fn(async () => ({})),
    getCounts: vi.fn(async () => ({})),
    getAllReadAndLikeCount: vi.fn(async () => ({})),
    getAllSiteWordsCount: vi.fn(async () => 0),
    getSiteInfo: vi.fn(async () => ({})),
    getCategoryDistribution: vi.fn(async () => []),
    getTagCloud: vi.fn(async () => []),
    getPublicationTrend: vi.fn(async () => []),
    getCommentActivity: vi.fn(async () => []),
    getTrafficSource: vi.fn(async () => ({})),
  }

  const translationService = {
    collectArticleTranslations: vi.fn(
      async () => opts.collectTranslations ?? defaultCollect,
    ),
  }

  const translationEntryService = {
    getTranslationsBatch: vi.fn(async () => opts.entryMaps ?? defaultEntryMaps),
  }

  const controller = new AggregateController(
    aggregateService as any,
    {
      get: vi.fn(async (key: string) => {
        if (key === 'url')
          return { webUrl: 'https://x.test', adminUrl: 'admin' }
        if (key === 'seo') return { title: 'site', description: 'd' }
        if (key === 'commentOptions')
          return { disableComment: false, allowGuestComment: true }
        if (key === 'ai') return { enableSummary: true }
        return {}
      }),
    } as any,
    {} as any,
    {
      getLatestNoteId: vi.fn(async () => 17),
    } as any,
    {
      getCachedSnippet: vi.fn(async () => null),
      getPublicSnippetByPath: vi.fn(async () => null),
    } as any,
    {
      getOwner: vi.fn(async () => ({ id: '1', name: 'Owner', socialIds: {} })),
    } as any,
    translationService as any,
    translationEntryService as any,
  )

  return {
    controller,
    translationService,
    translationEntryService,
    aggregateService,
  }
}

describe('AggregateController', () => {
  it('does not downgrade root aggregate dependency failures into cacheable partial responses', async () => {
    const controller = new AggregateController(
      {} as any,
      {
        get: vi.fn(async (key: string) => {
          if (key === 'url') throw new Error('url config unavailable')
          return {}
        }),
      } as any,
      {} as any,
      { getLatestNoteId: vi.fn(async () => 17) } as any,
      {
        getCachedSnippet: vi.fn(async () => null),
        getPublicSnippetByPath: vi.fn(async () => null),
      } as any,
      {
        getOwner: vi.fn(async () => ({
          id: '1',
          name: 'Owner',
          socialIds: {},
        })),
      } as any,
      {} as any,
      {} as any,
    )

    await expect(controller.aggregate({} as any)).rejects.toThrow(
      'url config unavailable',
    )
  })
})

describe('AggregateController.aggregate theme fallback', () => {
  const buildController = (snippets: Record<string, unknown>) => {
    const getPublicSnippetByPath = vi.fn(async (path: string) => {
      if (path in snippets) return snippets[path]
      throw new Error('not found')
    })

    return {
      controller: new AggregateController(
        {} as any,
        {
          get: vi.fn(async (key: string) => {
            if (key === 'url') return { webUrl: 'https://x.test' }
            if (key === 'seo') return { title: 's', description: 'd' }
            if (key === 'commentOptions') return {}
            if (key === 'ai') return {}
            return {}
          }),
        } as any,
        {} as any,
        { getLatestNoteId: vi.fn(async () => 1) } as any,
        {
          getCachedSnippetByPath: vi.fn(async () => null),
          getPublicSnippetByPath,
        } as any,
        {
          getOwner: vi.fn(async () => ({ id: '1', name: 'o', socialIds: {} })),
        } as any,
        {} as any,
        {} as any,
      ),
      getPublicSnippetByPath,
    }
  }

  it('returns undefined when no theme requested', async () => {
    const { controller, getPublicSnippetByPath } = buildController({})
    const res = await controller.aggregate({} as any)
    expect(res.theme).toBeUndefined()
    expect(getPublicSnippetByPath).not.toHaveBeenCalled()
  })

  it('returns single theme config when found', async () => {
    const { controller } = buildController({
      'theme/shiro': { color: 'red' },
    })
    const res = await controller.aggregate({ theme: 'shiro' } as any)
    expect(res.theme).toEqual({ color: 'red' })
  })

  it('merges lang overlay onto base for single theme', async () => {
    const { controller } = buildController({
      'theme/shiro': { color: 'red', title: 'zh' },
      'theme/shiro.ja': { title: 'ja' },
    })
    const res = await controller.aggregate({ theme: 'shiro' } as any, 'ja')
    expect(res.theme).toEqual({ color: 'red', title: 'ja' })
  })

  it('falls back to second candidate when first is missing', async () => {
    const { controller, getPublicSnippetByPath } = buildController({
      'theme/default': { color: 'blue' },
    })
    const res = await controller.aggregate({
      theme: 'shiro|default',
    } as any)
    expect(res.theme).toEqual({ color: 'blue' })
    expect(getPublicSnippetByPath).toHaveBeenCalledWith('theme/shiro')
    expect(getPublicSnippetByPath).toHaveBeenCalledWith('theme/default')
  })

  it('uses first hit and skips remaining candidates', async () => {
    const { controller, getPublicSnippetByPath } = buildController({
      'theme/shiro': { color: 'red' },
      'theme/default': { color: 'blue' },
    })
    const res = await controller.aggregate({
      theme: 'shiro|default|fallback',
    } as any)
    expect(res.theme).toEqual({ color: 'red' })
    const names = getPublicSnippetByPath.mock.calls.map((c) => c[0])
    expect(names).toContain('theme/shiro')
    expect(names).not.toContain('theme/default')
    expect(names).not.toContain('theme/fallback')
  })

  it('applies lang overlay scoped to the matched candidate', async () => {
    const { controller, getPublicSnippetByPath } = buildController({
      'theme/default': { color: 'blue', title: 'zh' },
      'theme/default.ja': { title: 'ja' },
      'theme/shiro.ja': { title: 'shouldNotUse' },
    })
    const res = await controller.aggregate(
      { theme: 'shiro|default' } as any,
      'ja',
    )
    expect(res.theme).toEqual({ color: 'blue', title: 'ja' })
    const calls = getPublicSnippetByPath.mock.calls.map((c) => c[0])
    expect(calls).not.toContain('theme/shiro.ja')
  })

  it('returns undefined when all candidates miss', async () => {
    const { controller } = buildController({})
    const res = await controller.aggregate({
      theme: 'a|b|c',
    } as any)
    expect(res.theme).toBeUndefined()
  })

  it('trims whitespace and skips empty segments', async () => {
    const { controller } = buildController({
      'theme/shiro': { ok: true },
    })
    const res = await controller.aggregate({
      theme: ' | shiro |  ',
    } as any)
    expect(res.theme).toEqual({ ok: true })
  })
})

describe('AggregateController seo resolution', () => {
  const seoWithI18n = {
    title: 'Base Title',
    description: 'Base Description',
    keywords: ['base1', 'base2'],
    i18n: {
      en: { description: 'EN Description', keywords: ['en1', 'en2'] },
    },
  }

  const buildController = () =>
    new AggregateController(
      {} as any,
      {
        get: vi.fn(async (key: string) => {
          if (key === 'url') return { webUrl: 'https://x.test' }
          if (key === 'seo') return seoWithI18n
          if (key === 'commentOptions') return {}
          if (key === 'ai') return {}
          return {}
        }),
      } as any,
      {} as any,
      { getLatestNoteId: vi.fn(async () => 1) } as any,
      {
        getCachedSnippetByPath: vi.fn(async () => null),
        getPublicSnippetByPath: vi.fn(async () => null),
      } as any,
      {
        getOwner: vi.fn(async () => ({ id: '1', name: 'o', socialIds: {} })),
      } as any,
      {} as any,
      {} as any,
    )

  it('aggregate() resolves seo for the request language and strips i18n', async () => {
    const controller = buildController()
    const res = await controller.aggregate({} as any, 'en')
    expect(res.seo).toEqual({
      title: 'Base Title',
      description: 'EN Description',
      keywords: ['en1', 'en2'],
    })
    expect(res.seo).not.toHaveProperty('i18n')
  })

  it('aggregate() falls back to base seo when lang is absent', async () => {
    const controller = buildController()
    const res = await controller.aggregate({} as any)
    expect(res.seo).toEqual({
      title: 'Base Title',
      description: 'Base Description',
      keywords: ['base1', 'base2'],
    })
    expect(res.seo).not.toHaveProperty('i18n')
  })

  it('site() resolves seo for the request language and strips i18n', async () => {
    const controller = buildController()
    const res = await controller.site('en')
    expect(res.seo).toEqual({
      title: 'Base Title',
      description: 'EN Description',
      keywords: ['en1', 'en2'],
    })
    expect(res.seo).not.toHaveProperty('i18n')
  })

  it('site() falls back to base seo when lang is absent', async () => {
    const controller = buildController()
    const res = await controller.site()
    expect(res.seo).toEqual({
      title: 'Base Title',
      description: 'Base Description',
      keywords: ['base1', 'base2'],
    })
    expect(res.seo).not.toHaveProperty('i18n')
  })
})

describe('AggregateController.top', () => {
  it('returns raw result when lang is absent', async () => {
    const { controller, aggregateService } = createController({
      topActivityResult: {
        notes: [makeNote()],
        posts: [makePost()],
        says: [],
        recently: [],
      },
    })
    const res = await controller.top({ size: 5 } as any, false)
    expect(res).not.toHaveProperty('meta')
    expect(aggregateService.topActivity).toHaveBeenCalledOnce()
  })

  it('translates titles in place and emits meta for translated items only', async () => {
    const note1 = makeNote({ id: 'n1', title: 'Japanese Diary' })
    const note2 = makeNote({ id: 'n2', title: 'Untranslated Note' })
    const post1 = makePost({ id: 'p1', title: 'Japanese Article' })

    const { controller } = createController({
      topActivityResult: {
        notes: [note1, note2],
        posts: [post1],
        says: [],
        recently: [],
      },
      collectTranslations: {
        results: new Map([
          ['n1', { ...TRANSLATED_TITLE_RESULT, title: 'Diary EN' }],
          ['n2', { ...UNTRANSLATED_RESULT, title: 'Untranslated Note' }],
          ['p1', { ...TRANSLATED_TITLE_RESULT, title: 'Article EN' }],
        ]),
        meta: new Map([
          ['n1', makeTranslationMeta('n1')],
          ['p1', makeTranslationMeta('p1')],
        ]),
      },
    })

    const res = await controller.top({ size: 5 } as any, false, 'en')

    expect(res.data.notes[0].title).toBe('Diary EN')
    expect(res.data.notes[1].title).toBe('Untranslated Note')
    expect(res.data.posts[0].title).toBe('Article EN')

    expect(res.meta?.translation?.['n1']).toBeDefined()
    expect(res.meta?.translation?.['p1']).toBeDefined()
    expect(res.meta?.translation?.['n2']).toBeUndefined()

    const articleMeta = res.meta?.translation?.['n1']?.article
    expect(articleMeta?.isTranslated).toBe(true)
    expect(articleMeta).not.toHaveProperty('title')
    expect(articleMeta).not.toHaveProperty('text')
  })

  it('translates note mood and weather in place via dict lookup', async () => {
    const note = makeNote({ id: 'n1', mood: 'Happy', weather: 'Sunny' })

    const { controller } = createController({
      topActivityResult: { notes: [note], posts: [], says: [], recently: [] },
      collectTranslations: {
        results: new Map([
          ['n1', { ...TRANSLATED_TITLE_RESULT, title: 'Diary EN' }],
        ]),
        meta: new Map([['n1', makeTranslationMeta('n1')]]),
      },
      entryMaps: {
        entityMaps: new Map(),
        dictMaps: new Map([
          ['note.mood', new Map([['Happy', 'Heureux']])],
          ['note.weather', new Map([['Sunny', 'Ensoleille']])],
        ]),
      },
    })

    const res = await controller.top({ size: 5 } as any, false, 'en')

    expect(res.data.notes[0].mood).toBe('Heureux')
    expect(res.data.notes[0].weather).toBe('Ensoleille')
  })

  it('returns raw result when no items are translated', async () => {
    const note = makeNote({ id: 'n1' })

    const { controller } = createController({
      topActivityResult: { notes: [note], posts: [], says: [], recently: [] },
      collectTranslations: {
        results: new Map([['n1', { ...UNTRANSLATED_RESULT }]]),
        meta: new Map(),
      },
    })

    const res = await controller.top({ size: 5 } as any, false, 'en')
    expect(res).not.toHaveProperty('meta')
  })
})

describe('AggregateController.getLatest', () => {
  it('returns raw result when lang is absent', async () => {
    const { controller } = createController({
      latestResult: { posts: [makePost()], notes: [makeNote()] },
    })
    const res = await controller.getLatest({ limit: 5, combined: false } as any)
    expect(res).not.toHaveProperty('meta')
  })

  it('combined=true: translates bare array items in place and emits meta', async () => {
    const p1 = { ...makePost({ id: 'p1' }), type: 'post' }
    const n1 = {
      ...makeNote({ id: 'n1', mood: 'Happy', weather: 'Clear' }),
      type: 'note',
    }

    const { controller } = createController({
      latestResult: [p1, n1],
      collectTranslations: {
        results: new Map([
          ['p1', { ...TRANSLATED_TITLE_RESULT, title: 'Post EN' }],
          ['n1', { ...TRANSLATED_TITLE_RESULT, title: 'Note EN' }],
        ]),
        meta: new Map([
          ['p1', makeTranslationMeta('p1')],
          ['n1', makeTranslationMeta('n1')],
        ]),
      },
      entryMaps: {
        entityMaps: new Map(),
        dictMaps: new Map([
          ['note.mood', new Map([['Happy', 'Happy EN']])],
          ['note.weather', new Map([['Clear', 'Clear EN']])],
        ]),
      },
    })

    const res = await controller.getLatest(
      { limit: 5, combined: true } as any,
      'en',
    )

    const postItem = (res.data as any[]).find((i: any) => i.id === 'p1')
    const noteItem = (res.data as any[]).find((i: any) => i.id === 'n1')

    expect(postItem.title).toBe('Post EN')
    expect(noteItem.title).toBe('Note EN')
    expect(noteItem.mood).toBe('Happy EN')
    expect(noteItem.weather).toBe('Clear EN')

    expect(res.meta?.translation?.['p1']).toBeDefined()
    expect(res.meta?.translation?.['n1']).toBeDefined()
  })

  it('separate mode: translates posts and notes independently', async () => {
    const p1 = makePost({ id: 'p1' })
    const n1 = makeNote({ id: 'n1' })
    const n2 = makeNote({ id: 'n2', title: 'Untranslated' })

    const { controller } = createController({
      latestResult: { posts: [p1], notes: [n1, n2] },
      collectTranslations: {
        results: new Map([
          ['p1', { ...TRANSLATED_TITLE_RESULT, title: 'Post EN' }],
          ['n1', { ...TRANSLATED_TITLE_RESULT, title: 'Note EN' }],
          ['n2', { ...UNTRANSLATED_RESULT, title: 'Untranslated' }],
        ]),
        meta: new Map([
          ['p1', makeTranslationMeta('p1')],
          ['n1', makeTranslationMeta('n1')],
        ]),
      },
    })

    const res = await controller.getLatest(
      { limit: 5, combined: false } as any,
      'en',
    )

    expect(res.data.posts[0].title).toBe('Post EN')
    expect(res.data.notes[0].title).toBe('Note EN')
    expect(res.data.notes[1].title).toBe('Untranslated')

    expect(res.meta?.translation?.['p1']).toBeDefined()
    expect(res.meta?.translation?.['n1']).toBeDefined()
    expect(res.meta?.translation?.['n2']).toBeUndefined()
  })
})

describe('AggregateController.getTimeline', () => {
  it('translates post/note titles, note mood/weather, and post category.name in place', async () => {
    const note = makeNote({ id: 'n1', mood: 'Calm', weather: 'Rainy' })
    const post = makePost({
      id: 'p1',
      title: 'Japanese Article',
      category: { id: 'cat1', name: 'Technology', slug: 'technology' },
    })

    const { controller } = createController({
      timelineResult: { notes: [note], posts: [post] },
      collectTranslations: {
        results: new Map([
          ['n1', { ...TRANSLATED_TITLE_RESULT, title: 'Note EN' }],
          ['p1', { ...TRANSLATED_TITLE_RESULT, title: 'Article EN' }],
        ]),
        meta: new Map([
          ['n1', makeTranslationMeta('n1')],
          ['p1', makeTranslationMeta('p1')],
        ]),
      },
      entryMaps: {
        entityMaps: new Map([
          ['category.name', new Map([['cat1', 'Technology EN']])],
        ]),
        dictMaps: new Map([
          ['note.mood', new Map([['Calm', 'Calme']])],
          ['note.weather', new Map([['Rainy', 'Pluvieux']])],
        ]),
      },
    })

    const res = await controller.getTimeline({ sort: 1 } as any, 'en')

    expect(res.data.notes[0].title).toBe('Note EN')
    expect(res.data.notes[0].mood).toBe('Calme')
    expect(res.data.notes[0].weather).toBe('Pluvieux')
    expect(res.data.posts[0].title).toBe('Article EN')
    expect(res.data.posts[0].category.name).toBe('Technology EN')

    expect(res.meta?.translation?.['n1']).toBeDefined()
    expect(res.meta?.translation?.['p1']).toBeDefined()

    const noteMeta = res.meta?.translation?.['n1']?.article
    expect(noteMeta?.isTranslated).toBe(true)
    expect(noteMeta).not.toHaveProperty('title')
    expect(noteMeta).not.toHaveProperty('text')
  })

  it('returns raw data when no items are translated', async () => {
    const note = makeNote({ id: 'n1' })

    const { controller } = createController({
      timelineResult: { notes: [note], posts: [] },
      collectTranslations: {
        results: new Map([['n1', { ...UNTRANSLATED_RESULT }]]),
        meta: new Map(),
      },
    })

    const res = await controller.getTimeline({ sort: 1 } as any, 'en')
    expect(res).not.toHaveProperty('meta')
  })

  it('returns raw data when lang is absent', async () => {
    const { controller } = createController({
      timelineResult: { notes: [makeNote()], posts: [makePost()] },
    })
    const res = await controller.getTimeline({ sort: 1 } as any)
    expect(res).not.toHaveProperty('meta')
  })
})

describe('AggregateController.getTopArticles', () => {
  it('translates titles in place and emits meta for translated items only', async () => {
    const articles = [
      {
        id: 'a1',
        title: 'Popular Post',
        slug: 'hot',
        reads: 100,
        likes: 10,
        category: null,
      },
      {
        id: 'a2',
        title: 'Another Post',
        slug: 'another',
        reads: 50,
        likes: 5,
        category: null,
      },
    ]

    const { controller } = createController({
      topArticlesResult: articles,
      collectTranslations: {
        results: new Map([
          ['a1', { ...TRANSLATED_TITLE_RESULT, title: 'Popular Article EN' }],
          ['a2', { ...UNTRANSLATED_RESULT, title: 'Another Post' }],
        ]),
        meta: new Map([['a1', makeTranslationMeta('a1')]]),
      },
    })

    const res = await controller.getTopArticles('en')

    expect(res.data[0].title).toBe('Popular Article EN')
    expect(res.data[1].title).toBe('Another Post')

    expect(res.meta?.translation?.['a1']).toBeDefined()
    expect(res.meta?.translation?.['a2']).toBeUndefined()

    const articleMeta = res.meta?.translation?.['a1']?.article
    expect(articleMeta?.isTranslated).toBe(true)
    expect(articleMeta).not.toHaveProperty('title')
    expect(articleMeta).not.toHaveProperty('text')
  })

  it('returns raw array when lang is absent', async () => {
    const articles = [
      {
        id: 'a1',
        title: 'Post',
        slug: 'post',
        reads: 100,
        likes: 10,
        category: null,
      },
    ]
    const { controller } = createController({ topArticlesResult: articles })
    const res = await controller.getTopArticles()
    expect(Array.isArray(res)).toBe(true)
    expect(res[0].title).toBe('Post')
  })

  it('returns raw array when no items are translated', async () => {
    const articles = [
      {
        id: 'a1',
        title: 'Post',
        slug: 'post',
        reads: 100,
        likes: 10,
        category: null,
      },
    ]
    const { controller } = createController({
      topArticlesResult: articles,
      collectTranslations: {
        results: new Map([['a1', { ...UNTRANSLATED_RESULT }]]),
        meta: new Map(),
      },
    })
    const res = await controller.getTopArticles('en')
    expect(Array.isArray(res)).toBe(true)
  })
})
