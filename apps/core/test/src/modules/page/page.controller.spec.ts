import { describe, expect, it, vi } from 'vitest'

import { PageController } from '~/modules/page/page.controller'

const makePage = (overrides: Record<string, unknown> = {}) => ({
  id: '8000000000000001001',
  title: 'Original title',
  text: 'original body',
  subtitle: 'original subtitle',
  content: null,
  contentFormat: null,
  meta: null,
  modifiedAt: null,
  createdAt: new Date('2024-01-01'),
  slug: 'test-page',
  order: 1,
  ...overrides,
})

const makeTranslationResult = (overrides: Record<string, unknown> = {}) => ({
  isTranslated: false,
  title: 'Original title',
  text: 'original body',
  subtitle: 'original subtitle',
  sourceLang: 'zh',
  availableTranslations: ['en'],
  ...overrides,
})

type CreateControllerOptions = {
  pages?: Record<string, unknown>[]
  translateArticleFn?: () => Promise<Record<string, unknown>>
  collectArticleTranslationsFn?: () => Promise<{
    results: Map<string, unknown>
    meta: Map<string, unknown>
  }>
  attachEnrichmentsFn?: (
    doc: Record<string, unknown>,
  ) => Promise<{ enrichments: Record<string, unknown> }>
}

const createController = (opts: CreateControllerOptions = {}) => {
  const {
    pages = [],
    translateArticleFn = async () => makeTranslationResult(),
    collectArticleTranslationsFn = async () => ({
      results: new Map(),
      meta: new Map(),
    }),
    attachEnrichmentsFn = async (doc: Record<string, unknown>) => ({
      enrichments: {},
      ...doc,
    }),
  } = opts

  const pageService = {
    listPaginated: vi.fn(async () => ({
      data: pages,
      pagination: {
        total: pages.length,
        currentPage: 1,
        totalPage: 1,
        size: 10,
      },
    })),
    findBySlug: vi.fn(async () => pages[0] ?? null),
    findById: vi.fn(async () => pages[0] ?? null),
  }

  const translationService = {
    translateArticle: vi.fn(translateArticleFn),
    collectArticleTranslations: vi.fn(collectArticleTranslationsFn),
  }

  const enrichmentService = {
    attachEnrichments: vi.fn(attachEnrichmentsFn),
  }

  const controller = new PageController(
    pageService as any,
    translationService as any,
    enrichmentService as any,
  )

  return {
    controller,
    pageService,
    translationService,
    enrichmentService,
  }
}

describe('PageController.getPageBySlug', () => {
  it('overwrites title, text, subtitle, content in place and emits slim translation meta', async () => {
    const page = makePage()
    const pageId = String(page.id)

    const translationResult = {
      isTranslated: true,
      title: 'Translated title',
      text: 'translated body',
      subtitle: 'translated subtitle',
      content: 'translated content',
      contentFormat: 'markdown',
      sourceLang: 'zh',
      translationMeta: {
        sourceLang: 'zh',
        targetLang: 'en',
        translatedAt: new Date('2024-06-01'),
        model: 'claude-haiku',
      },
      availableTranslations: ['en'],
    }

    const { controller } = createController({
      pages: [page],
      translateArticleFn: async () => translationResult,
    })

    const res = await controller.getPageBySlug('test-page', {} as any, 'en')

    expect(res.data.title).toBe('Translated title')
    expect(res.data.text).toBe('translated body')
    expect((res.data as any).subtitle).toBe('translated subtitle')
    expect((res.data as any).content).toBe('translated content')

    const tm = res.meta?.translation as any
    const pageTm = tm?.[pageId]
    expect(pageTm?.article?.isTranslated).toBe(true)
    expect(pageTm?.article?.sourceLang).toBe('zh')
    expect(pageTm?.article?.targetLang).toBe('en')
    expect(pageTm?.article?.title).toBeUndefined()
    expect(pageTm?.article?.text).toBeUndefined()
    expect(pageTm?.article?.subtitle).toBeUndefined()
    expect(pageTm?.article?.content).toBeUndefined()
    expect(pageTm?.article?.contentFormat).toBeUndefined()
  })

  it('always emits meta.translation even when not translated', async () => {
    const page = makePage()
    const pageId = String(page.id)

    const { controller } = createController({
      pages: [page],
      translateArticleFn: async () =>
        makeTranslationResult({ isTranslated: false }),
    })

    const res = await controller.getPageBySlug('test-page', {} as any, 'en')

    const tm = res.meta?.translation as any
    expect(tm?.[pageId]).toBeDefined()
    expect(tm?.[pageId]?.article?.isTranslated).toBe(false)
  })

  it('calls enrichmentService with already-translated content', async () => {
    const page = makePage()

    const translationResult = {
      isTranslated: true,
      title: 'Translated',
      text: 'translated body for enrichment check',
      subtitle: 'translated subtitle',
      content: 'translated content for enrichment check',
      contentFormat: 'markdown',
      sourceLang: 'zh',
      translationMeta: {
        sourceLang: 'zh',
        targetLang: 'en',
        translatedAt: new Date(),
        model: 'claude-haiku',
      },
      availableTranslations: ['en'],
    }

    const attachEnrichmentsSpy = vi.fn(
      async (doc: Record<string, unknown>) => ({
        enrichments: {},
        ...doc,
      }),
    )

    const { controller } = createController({
      pages: [page],
      translateArticleFn: async () => translationResult,
      attachEnrichmentsFn: attachEnrichmentsSpy,
    })

    await controller.getPageBySlug('test-page', {} as any, 'en')

    expect(attachEnrichmentsSpy).toHaveBeenCalledTimes(1)
    const calledWith = attachEnrichmentsSpy.mock.calls[0][0] as Record<
      string,
      unknown
    >
    expect(calledWith.text).toBe('translated body for enrichment check')
    expect(calledWith.content).toBe('translated content for enrichment check')
  })
})

describe('PageController.getPagesSummary', () => {
  it('overwrites title, text, subtitle, content per item when translated', async () => {
    const page = makePage()
    const pageId = String(page.id)

    const translatedResult = {
      isTranslated: true,
      title: 'Translated title',
      text: 'translated body',
      subtitle: 'translated subtitle',
      content: 'translated content',
      contentFormat: 'markdown',
      sourceLang: 'zh',
      translationMeta: {
        sourceLang: 'zh',
        targetLang: 'en',
        translatedAt: new Date('2024-06-01'),
        model: 'claude-haiku',
      },
      availableTranslations: ['en'],
    }

    const translationResults = new Map([[pageId, translatedResult]])
    const translationMeta = new Map([
      [
        pageId,
        {
          article: {
            isTranslated: true,
            sourceLang: 'zh',
            targetLang: 'en',
            translatedAt: new Date('2024-06-01'),
            model: 'claude-haiku',
            availableTranslations: ['en'],
          },
        },
      ],
    ])

    const { controller } = createController({
      pages: [page],
      collectArticleTranslationsFn: async () => ({
        results: translationResults as any,
        meta: translationMeta as any,
      }),
    })

    const res = await controller.getPagesSummary({} as any, 'en')

    expect(res.data[0].title).toBe('Translated title')
    expect(res.data[0].text).toBe('translated body')
    expect((res.data[0] as any).subtitle).toBe('translated subtitle')
    expect((res.data[0] as any).content).toBe('translated content')

    const tm = res.meta?.translation as any
    expect(tm?.[pageId]?.article?.isTranslated).toBe(true)
    expect(tm?.[pageId]?.article?.title).toBeUndefined()
    expect(tm?.[pageId]?.article?.text).toBeUndefined()
    expect(tm?.[pageId]?.article?.subtitle).toBeUndefined()
    expect(tm?.[pageId]?.article?.content).toBeUndefined()
  })

  it('emits meta.translation only for translated items in mixed list', async () => {
    const translatedPage = makePage({ id: '8000000000000001001', title: 'A' })
    const untranslatedPage = makePage({ id: '8000000000000001002', title: 'B' })

    const translationResults = new Map([
      [
        String(translatedPage.id),
        {
          isTranslated: true,
          title: 'A translated',
          text: 'body',
          subtitle: 'sub',
          sourceLang: 'zh',
          availableTranslations: [],
        },
      ],
      [
        String(untranslatedPage.id),
        {
          isTranslated: false,
          title: 'B',
          text: 'body',
          subtitle: 'sub',
          sourceLang: 'zh',
          availableTranslations: [],
        },
      ],
    ])

    const translationMeta = new Map([
      [
        String(translatedPage.id),
        {
          article: {
            isTranslated: true,
            sourceLang: 'zh',
            targetLang: 'en',
            availableTranslations: [],
          },
        },
      ],
    ])

    const { controller } = createController({
      pages: [translatedPage, untranslatedPage],
      collectArticleTranslationsFn: async () => ({
        results: translationResults as any,
        meta: translationMeta as any,
      }),
    })

    const res = await controller.getPagesSummary({} as any, 'en')

    const tm = res.meta?.translation as any
    expect(tm?.[String(translatedPage.id)]).toBeDefined()
    expect(tm?.[String(untranslatedPage.id)]).toBeUndefined()

    expect(res.data[0].title).toBe('A translated')
    expect(res.data[1].title).toBe('B')
  })

  it('no title/text/content/subtitle appear at any meta path', async () => {
    const page = makePage()
    const pageId = String(page.id)

    const translationMeta = new Map([
      [
        pageId,
        {
          article: {
            isTranslated: true,
            sourceLang: 'zh',
            targetLang: 'en',
            availableTranslations: [],
          },
        },
      ],
    ])

    const { controller } = createController({
      pages: [page],
      collectArticleTranslationsFn: async () => ({
        results: new Map([
          [
            pageId,
            {
              isTranslated: true,
              title: 'T',
              text: 't',
              subtitle: 's',
              sourceLang: 'zh',
              availableTranslations: [],
            },
          ],
        ]) as any,
        meta: translationMeta as any,
      }),
    })

    const res = await controller.getPagesSummary({} as any, 'en')

    const metaStr = JSON.stringify(res.meta?.translation ?? {})
    expect(metaStr).not.toContain('"title"')
    expect(metaStr).not.toContain('"text"')
    expect(metaStr).not.toContain('"content"')
    expect(metaStr).not.toContain('"subtitle"')
  })
})
