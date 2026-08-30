import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppException } from '~/common/errors/exception.types'
import { CollectionRefTypes } from '~/constants/db.constant'
import { AiInsightsAdapter } from '~/modules/ai/ai-insights/ai-insights.adapter'
import type { AiInsightsRepository } from '~/modules/ai/ai-insights/ai-insights.repository'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { MultilangGenerationService } from '~/modules/ai/ai-multilang/ai-multilang.service'

const row = {
  id: 'insights-1',
  refId: 'post-1',
  lang: 'zh',
  content: 'insight',
  hash: 'hash',
  isTranslation: false,
  sourceInsightsId: null,
  sourceLang: null,
  modelInfo: null,
  createdAt: now,
}

const createService = () => {
  const repository = createPgRepositoryMock<AiInsightsRepository>()
  const databaseService = {
    findGlobalById: vi.fn(),
    getRefArticleMap: vi.fn().mockResolvedValue({}),
    findArticleIdsByTitle: vi.fn().mockResolvedValue([]),
    findAllArticlesForAIText: vi
      .fn()
      .mockResolvedValue({ posts: [], notes: [] }),
  }
  const configService = {
    get: vi.fn(),
    waitForConfigReady: vi
      .fn()
      .mockResolvedValue({ ai: { enableInsights: true } }),
  }
  const aiService = {
    getInsightsModel: vi.fn(),
    getInsightsTranslationModel: vi.fn(),
  }
  const aiInFlightService = {
    runWithStream: vi.fn(async (opts: any) => {
      const { result } = await opts.onLeader({ push: async () => {} })
      return {
        events: (async function* () {})(),
        result: Promise.resolve(result),
      }
    }),
  }
  const taskProcessor = { registerHandler: vi.fn() }
  const aiTaskService = {
    createInsightsTask: vi.fn(),
    createInsightsTranslationTask: vi.fn(),
  }
  const eventEmitter = { emit: vi.fn() }
  const entitlementService = {
    isPremiumLocked: vi.fn(
      async (input: {
        isPremium?: boolean | null
        isOwner: boolean
        readerId?: string
      }) => Boolean(input.isPremium) && !input.isOwner && !input.readerId,
    ),
  }
  const generationMetrics = {
    attachLatest: vi.fn(async (_type: string, items: unknown[]) =>
      items.map((item) => ({
        ...(item as object),
        generationMetrics: null,
      })),
    ),
    deleteByResource: vi.fn().mockResolvedValue(undefined),
    record: vi.fn().mockResolvedValue(undefined),
  }
  const adapter = new AiInsightsAdapter(
    repository as any,
    databaseService as any,
    configService as any,
    aiService as any,
    eventEmitter as any,
    entitlementService as any,
  )
  const multilang = new MultilangGenerationService(
    aiInFlightService as any,
    generationMetrics as any,
    configService as any,
  )
  const service = new AiInsightsService(
    repository as any,
    databaseService as any,
    configService as any,
    adapter,
    multilang,
    taskProcessor as any,
    aiTaskService as any,
    generationMetrics as any,
  )
  return {
    aiInFlightService,
    aiService,
    aiTaskService,
    configService,
    databaseService,
    entitlementService,
    eventEmitter,
    generationMetrics,
    repository,
    service,
    taskProcessor,
  }
}

function runInsightsTask(
  harness: ReturnType<typeof createService>,
  payload: Record<string, unknown>,
) {
  harness.service.onModuleInit()
  const handler = harness.taskProcessor.registerHandler.mock.calls[0][0]
  const ctx = {
    isAborted: () => false,
    updateProgress: vi.fn(),
    setResult: vi.fn(),
    setStatus: vi.fn(),
    appendLog: vi.fn(),
    incrementTokens: vi.fn(),
    incrementCost: vi.fn(),
    taskId: 'task-1',
  }
  return handler.execute(payload, ctx).then(() => ctx)
}

describe('AiInsightsService', () => {
  it('checks insight language availability through the PG repository', async () => {
    const { repository, service } = createService()
    repository.findByRefAndLang.mockResolvedValue(row as any)

    await expect(service.hasInsightsInLang('post-1', 'zh')).resolves.toBe(true)
    expect(repository.findByRefAndLang).toHaveBeenCalledWith('post-1', 'zh')
  })

  it('updates insight content after validating the target row exists', async () => {
    const { repository, service } = createService()
    repository.findById.mockResolvedValue(row as any)
    repository.updateContent.mockResolvedValue({
      ...row,
      content: 'new',
    } as any)

    await expect(
      service.updateInsightsInDb('insights-1', 'new'),
    ).resolves.toMatchObject({
      id: 'insights-1',
      content: 'new',
    })
  })

  it('throws when updating a missing insight row', async () => {
    const { repository, service } = createService()
    repository.findById.mockResolvedValue(null)

    await expect(service.updateInsightsInDb('missing', 'new')).rejects.toThrow(
      AppException,
    )
  })

  it('loads grouped insight article metadata from the PG database service', async () => {
    const { databaseService, repository, service } = createService()
    repository.groupedByRef.mockResolvedValue({
      data: [{ refId: 'post-1' }],
      pagination: { total: 1 },
    })
    repository.findDistinctRefIds.mockResolvedValue(['post-1'])
    repository.listByRefIds.mockResolvedValue([row] as any)
    databaseService.findAllArticlesForAIText.mockResolvedValue({
      posts: [{ id: 'post-1', title: 'Post' }],
      notes: [],
    })
    databaseService.getRefArticleMap.mockResolvedValue({
      'post-1': { id: 'post-1', title: 'Post', type: CollectionRefTypes.Post },
    })

    await expect(
      service.getAllInsightsGrouped({ page: 1, size: 10 }),
    ).resolves.toMatchObject({
      data: [{ article: { id: 'post-1', title: 'Post' }, insights: [row] }],
      pagination: { total: 1, currentPage: 1, size: 10 },
    })
  })

  it('includes orphan articles with zero insights alongside records', async () => {
    const { databaseService, repository, service } = createService()
    repository.groupedByRef.mockResolvedValue({
      data: [{ refId: 'post-1' }],
      pagination: { total: 1 },
    })
    repository.findDistinctRefIds.mockResolvedValue(['post-1'])
    repository.listByRefIds.mockResolvedValue([row] as any)
    databaseService.findAllArticlesForAIText.mockResolvedValue({
      posts: [
        { id: 'post-1', title: 'Has Insight' },
        { id: 'post-2', title: 'Orphan Post' },
      ],
      notes: [{ id: 'note-9', title: 'Orphan Note' }],
    })
    databaseService.getRefArticleMap.mockResolvedValue({
      'post-1': {
        id: 'post-1',
        title: 'Has Insight',
        type: CollectionRefTypes.Post,
      },
    })

    const result = await service.getAllInsightsGrouped({ page: 1, size: 10 })

    expect(result.pagination).toMatchObject({ total: 3, currentPage: 1 })
    expect(result.data).toEqual([
      {
        article: {
          id: 'post-1',
          title: 'Has Insight',
          type: CollectionRefTypes.Post,
        },
        insights: [{ ...row, generationMetrics: null }],
      },
      {
        article: {
          id: 'post-2',
          title: 'Orphan Post',
          type: CollectionRefTypes.Post,
        },
        insights: [],
      },
      {
        article: {
          id: 'note-9',
          title: 'Orphan Note',
          type: CollectionRefTypes.Note,
        },
        insights: [],
      },
    ])
  })

  it('blocks the public article-insights read for a premium post', async () => {
    const { databaseService, service } = createService()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        title: 'Premium Post',
        text: 'Premium text',
        isPublished: true,
        isPremium: true,
      },
    })

    await expect(
      service.getOrGenerateInsightsForArticle('post-1', { lang: 'zh' }),
    ).rejects.toThrow(AppException)
  })

  it('blocks the public streamed article-insights for a premium post', async () => {
    const { configService, databaseService, service } = createService()
    configService.get.mockResolvedValue({ enableInsights: true })
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        title: 'Premium Post',
        text: 'Premium text',
        isPublished: true,
        isPremium: true,
      },
    })

    await expect(
      service.streamInsightsForArticle('post-1', { lang: 'zh' }),
    ).rejects.toThrow(AppException)
  })

  it('serves cached insights for a premium post to an entitled reader', async () => {
    const { databaseService, repository, service } = createService()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        title: 'Premium Post',
        text: 'Premium text',
        isPublished: true,
        isPremium: true,
      },
    })
    repository.findByRefAndLang.mockResolvedValue({
      ...row,
      hash: 'mismatch-so-onlyDb-returns-null',
    } as any)

    await expect(
      service.getOrGenerateInsightsForArticle('post-1', {
        lang: 'zh',
        onlyDb: true,
        readerId: 'reader-1',
      }),
    ).resolves.toBeNull()
  })

  it('serves cached insights for a premium post to the owner', async () => {
    const { databaseService, repository, service } = createService()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        title: 'Premium Post',
        text: 'Premium text',
        isPublished: true,
        isPremium: true,
      },
    })
    repository.findByRefAndLang.mockResolvedValue({
      ...row,
      hash: 'mismatch-so-onlyDb-returns-null',
    } as any)

    await expect(
      service.getOrGenerateInsightsForArticle('post-1', {
        lang: 'zh',
        onlyDb: true,
        isOwner: true,
      }),
    ).resolves.toBeNull()
  })

  it('does not block background insight regeneration for a premium post', async () => {
    const {
      aiTaskService,
      configService,
      databaseService,
      repository,
      service,
    } = createService()
    configService.get.mockResolvedValue({
      enableInsights: true,
      enableAutoGenerateInsightsOnUpdate: true,
      insightsMinTextLength: 0,
    })
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        title: 'Premium Post',
        text: 'Long enough premium text',
        isPublished: true,
        isPremium: true,
      },
    })
    repository.findSourceForRef.mockResolvedValue(null)

    await service.handleUpdateArticle({ id: 'post-1' })

    expect(aiTaskService.createInsightsTask).toHaveBeenCalledWith({
      refId: 'post-1',
    })
  })

  it('creates an initial insights task on update when no source insight exists', async () => {
    const {
      aiTaskService,
      configService,
      databaseService,
      repository,
      service,
    } = createService()
    configService.get.mockResolvedValue({
      enableInsights: true,
      enableAutoGenerateInsightsOnUpdate: true,
      insightsMinTextLength: 0,
    })
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        title: 'Published Post',
        text: 'Long enough text',
        isPublished: true,
      },
    })
    repository.findSourceForRef.mockResolvedValue(null)

    await service.handleUpdateArticle({ id: 'post-1' })

    expect(aiTaskService.createInsightsTask).toHaveBeenCalledWith({
      refId: 'post-1',
    })
  })

  it('looks up the base row by the resolved source language', async () => {
    const { databaseService, repository, service } = createService()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        title: 'English Post',
        text: 'English text',
        isPublished: true,
        meta: { lang: 'en-US' },
      },
    })
    repository.findSourceForRef.mockResolvedValue(null)

    await service.findSourceInsightsForArticle('post-1')

    expect(repository.findSourceForRef).toHaveBeenCalledWith('post-1', 'en')
  })
})

describe('AiInsightsService — insights task target languages', () => {
  const setup = () => {
    const harness = createService()
    harness.configService.get.mockResolvedValue({
      enableInsights: true,
      translationLangConcurrency: 2,
    })
    harness.databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        title: 'Published Post',
        text: 'Long enough text',
        isPublished: true,
      },
    })
    harness.aiService.getInsightsModel.mockResolvedValue({
      generateText: vi.fn(async () => ({ text: 'base insight', usage: {} })),
      providerInfo: { id: 'test-provider', model: 'test-model' },
    })
    harness.aiService.getInsightsTranslationModel.mockResolvedValue({
      generateText: vi.fn(async () => ({
        text: 'translated insight',
        usage: {},
      })),
      providerInfo: { id: 'test-provider', model: 'test-model' },
    })
    harness.repository.findSourceForRef.mockResolvedValue(null)
    harness.repository.findByRefAndLang.mockResolvedValue(null)
    harness.repository.deleteTranslationsWithDifferentHash.mockResolvedValue(0)
    harness.repository.upsert.mockImplementation(async (input: any) => ({
      ...row,
      ...input,
      id: input.isTranslation ? `insights-${input.lang}` : 'insights-1',
    }))
    return harness
  }

  it('translates each requested target inline after the base row exists', async () => {
    const harness = setup()

    const ctx = await runInsightsTask(harness, {
      refId: 'post-1',
      targetLanguages: ['en', 'jp'],
    })

    const upserts = harness.repository.upsert.mock.calls.map(
      ([input]: any[]) => input,
    )
    expect(upserts[0]).toMatchObject({ lang: 'zh', isTranslation: false })
    expect(upserts).toContainEqual(
      expect.objectContaining({
        lang: 'ja',
        isTranslation: true,
        sourceInsightsId: 'insights-1',
        content: 'translated insight',
      }),
    )
    expect(upserts).toContainEqual(
      expect.objectContaining({ lang: 'en', isTranslation: true }),
    )
    expect(
      harness.aiTaskService.createInsightsTranslationTask,
    ).not.toHaveBeenCalled()
    expect(ctx.setResult).toHaveBeenCalledWith(
      expect.objectContaining({
        insightsId: 'insights-1',
        lang: 'zh',
        translated: expect.arrayContaining(['en', 'ja']),
      }),
    )
  })

  it('generates a draft in an owner task without exposing it to public reads', async () => {
    const harness = setup()
    harness.databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: 'post-1',
        title: 'Draft Post',
        text: 'Draft text',
        isPublished: false,
      },
    })

    await expect(
      runInsightsTask(harness, { refId: 'post-1' }),
    ).resolves.toBeDefined()
    await expect(
      harness.service.getOrGenerateInsightsForArticle('post-1', {
        lang: 'zh',
        onlyDb: true,
      }),
    ).rejects.toThrow(AppException)
  })

  it('never translates the base row into its own language', async () => {
    const harness = setup()

    await runInsightsTask(harness, {
      refId: 'post-1',
      targetLanguages: ['zh-CN'],
    })

    const upserts = harness.repository.upsert.mock.calls.map(
      ([input]: any[]) => input,
    )
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toMatchObject({ lang: 'zh', isTranslation: false })
    expect(harness.aiService.getInsightsTranslationModel).not.toHaveBeenCalled()
  })

  it('carries force into the inline translation, so a regenerate is forced end to end', async () => {
    const harness = setup()

    await runInsightsTask(harness, {
      refId: 'post-1',
      force: true,
      targetLanguages: ['en'],
    })

    const streamCalls = harness.aiInFlightService.runWithStream.mock.calls.map(
      ([opts]: any[]) => opts,
    )
    expect(streamCalls).toHaveLength(2)
    for (const opts of streamCalls) {
      expect(opts.bypassResultCache).toBe(true)
    }
  })
})
