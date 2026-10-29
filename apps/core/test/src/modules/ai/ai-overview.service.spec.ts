import { describe, expect, it, vi } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import type { AiOverviewRepository } from '~/modules/ai/ai-overview/ai-overview.repository'
import { AiOverviewService } from '~/modules/ai/ai-overview/ai-overview.service'

const ARTICLES = {
  posts: [
    { id: '300', title: 'Newest post' },
    { id: '100', title: 'Oldest post' },
  ],
  notes: [{ id: '200', title: 'A note' }],
  pages: [{ id: '400', title: 'About' }],
}

function createService(
  overrides: {
    repository?: Partial<AiOverviewRepository>
    documents?: Record<string, { meta?: Record<string, unknown> | null }>
    sums?: Array<Record<string, unknown>>
    models?: string[]
    tasks?: Array<Record<string, unknown>>
  } = {},
) {
  const repository = {
    coverageByRefIds: vi.fn(async () => ({
      summary: [],
      insights: [],
      translation: [],
      tts: [],
    })),
    summaryAssets: vi.fn(async () => []),
    insightsAssets: vi.fn(async () => []),
    translationAssets: vi.fn(async () => []),
    ttsAssets: vi.fn(async () => []),
    ...overrides.repository,
  }

  const documents = overrides.documents ?? {}
  const databaseService = {
    findAllArticlesForTranslation: vi.fn(async () => ARTICLES),
    findArticleIdsByTitle: vi.fn(async () => []),
    findGlobalByIds: vi.fn(async (ids: string[]) => ({
      posts: ARTICLES.posts
        .filter((a) => ids.includes(a.id))
        .map((a) => ({ ...a, ...documents[a.id] })),
      notes: ARTICLES.notes
        .filter((a) => ids.includes(a.id))
        .map((a) => ({ ...a, ...documents[a.id] })),
      pages: ARTICLES.pages
        .filter((a) => ids.includes(a.id))
        .map((a) => ({ ...a, ...documents[a.id] })),
      recentlies: [],
    })),
    findGlobalById: vi.fn(async (id: string) => ({
      type: CollectionRefTypes.Post,
      document: { id, title: 'Newest post', ...documents[id] },
    })),
  }

  const configService = {
    get: vi.fn(async () => ({
      summaryTargetLanguages: ['zh-CN', 'en-US'],
      insightsTargetLanguages: ['zh-CN'],
      translationTargetLanguages: ['zh-CN', 'en-US', 'ja-JP'],
    })),
  }

  const generationMetrics = {
    attachLatest: vi.fn(async (_type: string, items: unknown[]) =>
      items.map((item) => ({ ...(item as object), generationMetrics: null })),
    ),
    sumByRef: vi.fn(async () => overrides.sums ?? []),
    findModelsByRef: vi.fn(async () => overrides.models ?? []),
  }

  const taskQueueService = {
    getTasks: vi.fn(async () => ({ data: overrides.tasks ?? [], total: 0 })),
  }
  const multilang = {
    computeContentHash: vi.fn((text: string) => `hash:${text}`),
  }

  const service = new AiOverviewService(
    repository as unknown as AiOverviewRepository,
    databaseService as never,
    configService as never,
    generationMetrics as never,
    taskQueueService as never,
    multilang as never,
  )

  return {
    service,
    repository,
    configService,
    databaseService,
    generationMetrics,
    taskQueueService,
    multilang,
  }
}

describe('AiOverviewService.getOverviewGrouped', () => {
  it('lists every article newest first and counts the full set', async () => {
    const { service } = createService()

    const result = await service.getOverviewGrouped({ page: 1, size: 20 })

    expect(result.data.map((row) => row.article.id)).toEqual([
      '400',
      '300',
      '200',
      '100',
    ])
    expect(result.pagination.total).toBe(4)
  })

  it('paginates the ordered set', async () => {
    const { service } = createService()

    const result = await service.getOverviewGrouped({ page: 2, size: 2 })

    expect(result.data.map((row) => row.article.id)).toEqual(['200', '100'])
    expect(result.pagination.hasNextPage).toBe(false)
  })

  it('returns nothing when a search matches no article', async () => {
    const { service, databaseService, repository } = createService()
    databaseService.findArticleIdsByTitle.mockResolvedValue([])

    const result = await service.getOverviewGrouped({
      page: 1,
      size: 20,
      search: 'nope',
    })

    expect(result.data).toEqual([])
    expect(result.pagination.total).toBe(0)
    expect(repository.coverageByRefIds).not.toHaveBeenCalled()
  })

  it('restricts the set to search hits', async () => {
    const { service, databaseService } = createService()
    databaseService.findArticleIdsByTitle.mockResolvedValue(['200'])

    const result = await service.getOverviewGrouped({
      page: 1,
      size: 20,
      search: 'note',
    })

    expect(result.data.map((row) => row.article.id)).toEqual(['200'])
    expect(result.pagination.total).toBe(1)
  })

  it('derives coverage and gaps per article', async () => {
    const { service } = createService({
      documents: { '300': { meta: { lang: 'zh-CN' } } },
      repository: {
        coverageByRefIds: vi.fn(async () => ({
          summary: [{ refId: '300', lang: 'zh-CN' }],
          insights: [],
          translation: [{ refId: '300', lang: 'en-US', sourceLang: 'zh-CN' }],
          tts: [],
        })),
      },
    })

    const result = await service.getOverviewGrouped({ page: 1, size: 20 })
    const post = result.data.find((row) => row.article.id === '300')!

    expect(post.coverage.sourceLang).toBe('zh-CN')
    expect(post.coverage.summary.langs).toEqual(['zh-CN'])
    expect(post.coverage.translation.expected).toEqual(['en-US', 'ja-JP'])
    // summary en + insights zh + translation ja + tts zh & en
    expect(post.gapCount).toBe(5)
  })

  it('folds legacy language codes onto canonical columns', async () => {
    const { service } = createService({
      repository: {
        coverageByRefIds: vi.fn(async () => ({
          summary: [
            { refId: '300', lang: 'zh' },
            { refId: '300', lang: 'zh-CN' },
          ],
          insights: [{ refId: '300', lang: 'zh' }],
          translation: [
            { refId: '300', lang: 'en', sourceLang: 'zh' },
            { refId: '300', lang: 'en-US', sourceLang: 'zh-CN' },
          ],
          tts: [{ refId: '300', lang: 'en' }],
        })),
      },
    })

    const result = await service.getOverviewGrouped({ page: 1, size: 20 })
    const post = result.data.find((row) => row.article.id === '300')!

    expect(post.coverage.sourceLang).toBe('zh-CN')
    expect(post.coverage.summary.langs).toEqual(['zh-CN'])
    expect(post.coverage.insights.langs).toEqual(['zh-CN'])
    expect(post.coverage.translation.langs).toEqual(['en-US'])
    expect(post.coverage.tts.langs).toEqual(['en-US'])
    expect(post.coverage.tts.expected).toEqual(['en-US', 'zh-CN'])
  })

  it('marks only summary and insights inapplicable on pages', async () => {
    const { service } = createService()

    const result = await service.getOverviewGrouped({ page: 1, size: 20 })
    const page = result.data.find((row) => row.article.id === '400')!

    expect(page.coverage.summary.applicable).toBe(false)
    expect(page.coverage.insights.applicable).toBe(false)
    expect(page.coverage.tts.applicable).toBe(true)
    expect(page.coverage.translation.applicable).toBe(true)
  })

  it('does not claim a source language for articles without meta.lang', async () => {
    const { service } = createService()

    const result = await service.getOverviewGrouped({ page: 1, size: 20 })

    expect(result.data.every((row) => row.coverage.sourceLang === null)).toBe(
      true,
    )
  })
})

describe('AiOverviewService.getArticleOverview', () => {
  it('keeps track of generations with unknown costs in the total and feature buckets', async () => {
    const { service } = createService({
      sums: [
        {
          resourceType: 'summary',
          inputTokens: 10,
          outputTokens: 2,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 12,
          costTotalUsd: 0.01,
          generationCount: 3,
          unknownCostCount: 2,
        },
      ],
    })
    const detail = await service.getArticleOverview('300')
    expect(detail.cost.total.unknownCostCount).toBe(2)
    expect(detail.cost.byResourceType.summary.unknownCostCount).toBe(2)
    expect(detail.cost.total.costTotalUsd).toBe(0.01)
  })
  it('marks generated resources whose source no longer matches the article', async () => {
    const { service } = createService({
      documents: { '300': { text: 'current body' } as never },
      repository: {
        summaryAssets: vi.fn(async () => [
          {
            id: 's1',
            hash: 'hash:older body',
            lang: 'zh-CN',
            summary: 'old summary',
            isTranslation: false,
            sourceLang: 'zh-CN',
            createdAt: new Date(),
          },
        ]),
        insightsAssets: vi.fn(async () => [
          {
            id: 'i1',
            hash: 'hash:current body',
            lang: 'zh-CN',
            content: 'current insights',
            isTranslation: false,
            sourceLang: 'zh-CN',
            createdAt: new Date(),
          },
        ]),
      } as never,
    })

    const detail = await service.getArticleOverview('300')

    expect(detail.assets.summary[0].stale).toBe(true)
    expect(detail.assets.insights[0].stale).toBe(false)
  })

  it('sums cost per resource type and across all of them', async () => {
    const { service } = createService({
      models: ['gpt-5-mini'],
      sums: [
        {
          resourceType: 'summary',
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 150,
          costTotalUsd: 0.001,
          generationCount: 2,
        },
        {
          resourceType: 'translation',
          inputTokens: 400,
          outputTokens: 200,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 600,
          costTotalUsd: 0.004,
          generationCount: 1,
        },
      ],
    })

    const detail = await service.getArticleOverview('300')

    expect(detail.cost.total.totalTokens).toBe(750)
    expect(detail.cost.total.generationCount).toBe(3)
    expect(detail.cost.total.costTotalUsd).toBeCloseTo(0.005)
    expect(detail.cost.byResourceType.summary.generationCount).toBe(2)
    expect(detail.cost.byResourceType.insights.generationCount).toBe(0)
    expect(detail.cost.models).toEqual(['gpt-5-mini'])
  })

  it('builds coverage from the assets it loaded', async () => {
    const { service } = createService({
      documents: { '300': { meta: { lang: 'zh-CN' } } },
      repository: {
        summaryAssets: vi.fn(async () => [
          { id: 's1', lang: 'zh-CN', summary: 'x', createdAt: new Date() },
        ]),
        translationAssets: vi.fn(async () => [
          {
            id: 't1',
            lang: 'en-US',
            sourceLang: 'zh-CN',
            aiModel: null,
            createdAt: new Date(),
            updatedAt: null,
          },
        ]),
      } as never,
    })

    const detail = await service.getArticleOverview('300')

    // `meta.lang` is a locale here; it must normalise before comparisons.
    expect(detail.coverage.sourceLang).toBe('zh-CN')
    expect(detail.coverage.summary.langs).toEqual(['zh-CN'])
    expect(detail.coverage.tts.expected).toEqual(['en-US', 'zh-CN'])
    expect(detail.assets.translation).toHaveLength(1)
  })

  it('reports legacy-coded assets under canonical tags and pairs translated TTS with its translation', async () => {
    const { service } = createService({
      documents: { '300': { meta: { lang: 'zh' } } },
      repository: {
        translationAssets: vi.fn(async () => [
          {
            id: 't1',
            hash: 'h',
            lang: 'en',
            sourceLang: 'zh',
            aiModel: null,
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-03-01'),
          },
        ]),
        ttsAssets: vi.fn(async () => [
          {
            id: 'a1',
            lang: 'en-US',
            sourceLang: 'zh-CN',
            isTranslation: true,
            sourceModifiedAt: null,
            createdAt: new Date('2026-02-01'),
            updatedAt: null,
          },
        ]),
      } as never,
    })

    const detail = await service.getArticleOverview('300')

    expect(detail.assets.translation[0]).toMatchObject({
      lang: 'en-US',
      sourceLang: 'zh-CN',
    })
    expect(detail.assets.tts[0].stale).toBe(true)
    expect(detail.coverage.translation.langs).toEqual(['en-US'])
    expect(detail.coverage.tts.langs).toEqual(['en-US'])
  })

  it('rejects an unknown article', async () => {
    const { service, databaseService } = createService()
    databaseService.findGlobalById.mockResolvedValue(null as never)

    await expect(service.getArticleOverview('999')).rejects.toThrow()
  })

  it('canonicalizes the configured target languages and drops invalid ones', async () => {
    const { service, configService } = createService({
      repository: {
        summaryAssets: vi.fn(async () => [
          { id: 's1', lang: 'zh-CN', summary: 'x', createdAt: new Date() },
        ]),
      } as never,
    })
    configService.get.mockResolvedValue({
      summaryTargetLanguages: ['zh', 'zh-CN'],
      insightsTargetLanguages: ['jp', 'ja'],
      translationTargetLanguages: ['en_US', 'EN'],
    })

    const detail = await service.getArticleOverview('300')

    expect(detail.coverage.summary.expected).toEqual(['zh-CN'])
    expect(detail.coverage.summary.langs).toEqual(['zh-CN'])
    expect(detail.coverage.insights.expected).toEqual(['ja-JP'])
    expect(detail.coverage.translation.expected).toEqual(['en-US'])
  })

  it('looks up active tasks for this article only, sub-tasks included', async () => {
    const { service, taskQueueService } = createService()

    await service.getArticleOverview('300')

    expect(taskQueueService.getTasks).toHaveBeenCalledWith(
      expect.objectContaining({ includeSubTasks: true, refId: '300' }),
    )
  })
})
