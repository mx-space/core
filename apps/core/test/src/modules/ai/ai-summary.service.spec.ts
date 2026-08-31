import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppException } from '~/common/errors/exception.types'
import { CollectionRefTypes } from '~/constants/db.constant'
import { MultilangGenerationService } from '~/modules/ai/ai-multilang/ai-multilang.service'
import { AiSummaryAdapter } from '~/modules/ai/ai-summary/ai-summary.adapter'
import type { AiSummaryRepository } from '~/modules/ai/ai-summary/ai-summary.repository'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'
import { AITaskType } from '~/modules/ai/ai-task/ai-task.types'

const createService = () => {
  const repository = createPgRepositoryMock<AiSummaryRepository>()
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
      .mockResolvedValue({ ai: { enableSummary: true } }),
  }
  const aiService = {
    getSummaryModel: vi.fn(),
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
  const eventEmitter = { emit: vi.fn() }
  const taskProcessor = { registerHandler: vi.fn() }
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
  const adapter = new AiSummaryAdapter(
    repository as any,
    databaseService as any,
    configService as any,
    aiService as any,
    eventEmitter as any,
  )
  const multilang = new MultilangGenerationService(
    aiInFlightService as any,
    generationMetrics as any,
    configService as any,
  )
  const service = new AiSummaryService(
    repository as any,
    databaseService as any,
    configService as any,
    adapter,
    multilang,
    taskProcessor as any,
    generationMetrics as any,
  )
  return {
    aiInFlightService,
    aiService,
    configService,
    databaseService,
    eventEmitter,
    generationMetrics,
    repository,
    service,
    taskProcessor,
  }
}

const visibleArticle = {
  type: CollectionRefTypes.Post,
  document: {
    id: 'post-1',
    title: 'Published Post',
    text: 'Long enough text',
    isPublished: true,
  },
}

const summaryRuntime = () => ({
  generateText: vi.fn(async ({ messages }: any) => {
    const isTranslation = String(messages[0].content).includes('translator')
    return {
      text: isTranslation ? 'translated summary' : '{"summary":"a summary"}',
      usage: {},
    }
  }),
  providerInfo: { id: 'test-provider', model: 'test-model' },
})

function runSummaryTask(
  harness: ReturnType<typeof createService>,
  payload: Record<string, unknown>,
  context?: Record<string, unknown>,
) {
  harness.service.onModuleInit()
  const handler = harness.taskProcessor.registerHandler.mock.calls
    .map(([registered]) => registered)
    .find((registered: any) => registered.type === AITaskType.Summary) as any
  const ctx = {
    taskId: 'task-1',
    isAborted: () => false,
    appendLog: vi.fn(),
    updateProgress: vi.fn(),
    setResult: vi.fn(),
    setStatus: vi.fn(),
    incrementTokens: vi.fn(),
    incrementCost: vi.fn(),
    ...context,
  }
  return handler.execute(payload, ctx as any).then(() => ctx)
}

describe('AiSummaryService', () => {
  it('updates summaries through the PG repository after existence validation', async () => {
    const { repository, service } = createService()
    repository.findById.mockResolvedValue({
      id: 'summary-1',
      refId: 'post-1',
      lang: 'zh',
      summary: 'old',
      hash: 'hash',
      createdAt: now,
    })
    repository.updateSummary.mockResolvedValue({
      id: 'summary-1',
      refId: 'post-1',
      lang: 'zh',
      summary: 'new',
      hash: 'hash',
      createdAt: now,
    })

    await expect(
      service.updateSummaryInDb('summary-1', 'new'),
    ).resolves.toMatchObject({
      id: 'summary-1',
      summary: 'new',
    })
    expect(repository.updateSummary).toHaveBeenCalledWith('summary-1', 'new')
  })

  it('throws when updating a missing summary row', async () => {
    const { repository, service } = createService()
    repository.findById.mockResolvedValue(null)

    await expect(service.updateSummaryInDb('missing', 'new')).rejects.toThrow(
      AppException,
    )
  })

  it('deletes summaries by article id through the PG repository', async () => {
    const { generationMetrics, repository, service } = createService()
    repository.listForRef.mockResolvedValue([
      {
        id: 'summary-1',
        refId: 'post-1',
        lang: 'zh',
        summary: 'old',
        hash: 'hash',
        createdAt: now,
      },
    ])
    repository.deleteForRef.mockResolvedValue(1)

    await service.deleteSummaryByArticleId('post-1')

    expect(repository.deleteForRef).toHaveBeenCalledWith('post-1')
    expect(generationMetrics.deleteByResource).toHaveBeenCalledWith(
      'summary',
      'summary-1',
    )
  })

  it('includes orphan articles with zero summaries in the grouped list', async () => {
    const { databaseService, repository, service } = createService()
    repository.groupedByRef.mockResolvedValue({
      data: [{ refId: 'post-1' }],
      pagination: { total: 1 },
    } as any)
    repository.findDistinctRefIds.mockResolvedValue(['post-1'])
    repository.listByRefIds.mockResolvedValue([
      {
        id: 'summary-1',
        refId: 'post-1',
        lang: 'zh',
        summary: 'Hello',
        hash: 'hash',
        createdAt: now,
      },
    ])
    databaseService.findAllArticlesForAIText.mockResolvedValue({
      posts: [
        { id: 'post-1', title: 'Has Summary' },
        { id: 'post-2', title: 'Orphan Post' },
      ],
      notes: [],
    })
    databaseService.getRefArticleMap.mockResolvedValue({
      'post-1': {
        id: 'post-1',
        title: 'Has Summary',
        type: CollectionRefTypes.Post,
      },
    })

    const result = await service.getAllSummariesGrouped({
      page: 1,
      size: 10,
    })

    expect(result.pagination).toMatchObject({ total: 2, currentPage: 1 })
    expect(result.data).toEqual([
      {
        article: {
          id: 'post-1',
          title: 'Has Summary',
          type: CollectionRefTypes.Post,
        },
        summaries: [
          expect.objectContaining({ id: 'summary-1', refId: 'post-1' }),
        ],
      },
      {
        article: {
          id: 'post-2',
          title: 'Orphan Post',
          type: CollectionRefTypes.Post,
        },
        summaries: [],
      },
    ])
  })
})

describe('AiSummaryService — summary task pipeline', () => {
  const setup = () => {
    const harness = createService()
    harness.configService.get.mockResolvedValue({
      enableSummary: true,
      summaryTargetLanguages: [],
      translationLangConcurrency: 2,
    })
    harness.databaseService.findGlobalById.mockResolvedValue(visibleArticle)
    harness.aiService.getSummaryModel.mockResolvedValue(summaryRuntime())
    harness.repository.findBaseForRef.mockResolvedValue(null)
    harness.repository.findByRefAndLang.mockResolvedValue(null)
    harness.repository.upsert.mockImplementation(async (input: any) => ({
      id: input.isTranslation ? `summary-${input.lang}` : 'summary-base',
      refId: input.refId,
      lang: input.lang,
      summary: input.summary,
      hash: input.hash,
      isTranslation: input.isTranslation ?? false,
      sourceSummaryId: input.sourceSummaryId ?? null,
      sourceLang: input.sourceLang ?? null,
      createdAt: now,
    }))
    return harness
  }

  it('generates the source-language base first, then translates the other targets from it', async () => {
    const harness = setup()

    const ctx = await runSummaryTask(harness, {
      refId: 'post-1',
      targetLanguages: ['en', 'zh'],
    })

    const upserts = harness.repository.upsert.mock.calls.map(
      ([input]: any[]) => input,
    )
    expect(upserts[0]).toMatchObject({
      lang: 'zh',
      isTranslation: false,
      sourceLang: 'zh',
    })
    expect(upserts).toContainEqual(
      expect.objectContaining({
        lang: 'en',
        isTranslation: true,
        sourceSummaryId: 'summary-base',
        summary: 'translated summary',
      }),
    )
    expect(ctx.setResult).toHaveBeenCalledWith({
      summaries: [
        expect.objectContaining({ summaryId: 'summary-base', lang: 'zh' }),
        expect.objectContaining({ summaryId: 'summary-en', lang: 'en' }),
      ],
      failedLangs: [],
    })
  })

  it('generates a draft in an owner task without exposing it to public reads', async () => {
    const harness = setup()
    harness.databaseService.findGlobalById.mockResolvedValue({
      ...visibleArticle,
      document: { ...visibleArticle.document, isPublished: false },
    })

    await expect(
      runSummaryTask(harness, { refId: 'post-1' }),
    ).resolves.toBeDefined()
    await expect(
      harness.service.getSummaryByArticleId('post-1'),
    ).rejects.toThrow(AppException)
  })

  it('keeps an unrecognized token as its own target instead of collapsing it into zh', async () => {
    const harness = setup()

    const ctx = await runSummaryTask(harness, {
      refId: 'post-1',
      targetLanguages: ['english', 'zh'],
    })

    expect(ctx.updateProgress.mock.calls[0]).toEqual([
      0,
      'Generating summary (zh)',
      0,
      2,
    ])
    const upserts = harness.repository.upsert.mock.calls.map(
      ([input]: any[]) => input,
    )
    expect(upserts).toContainEqual(
      expect.objectContaining({ lang: 'english', isTranslation: true }),
    )
  })

  it('reuses a fresh base row instead of regenerating it', async () => {
    const harness = setup()
    const contentHash = (harness.service as any).multilang.computeContentHash(
      visibleArticle.document.text,
    )
    harness.repository.findBaseForRef.mockResolvedValue({
      id: 'summary-base',
      refId: 'post-1',
      lang: 'zh',
      summary: 'a summary',
      hash: contentHash,
      isTranslation: false,
      sourceSummaryId: null,
      sourceLang: 'zh',
      createdAt: now,
    })

    await runSummaryTask(harness, {
      refId: 'post-1',
      targetLanguages: ['en'],
    })

    const upserts = harness.repository.upsert.mock.calls.map(
      ([input]: any[]) => input,
    )
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toMatchObject({ lang: 'en', isTranslation: true })
  })

  it('marks the task partially failed when a translation fails but the base succeeded', async () => {
    const harness = setup()
    const runtime = {
      generateText: vi.fn(async ({ messages }: any) => {
        if (String(messages[0].content).includes('translator')) {
          throw new Error('translation blew up')
        }
        return { text: '{"summary":"a summary"}', usage: {} }
      }),
      providerInfo: { id: 'test-provider', model: 'test-model' },
    }
    harness.aiService.getSummaryModel.mockResolvedValue(runtime)

    const ctx = await runSummaryTask(harness, {
      refId: 'post-1',
      targetLanguages: ['en'],
    })

    expect(ctx.setStatus).toHaveBeenCalledWith('partial_failed')
    expect(ctx.setResult).toHaveBeenCalledWith(
      expect.objectContaining({ failedLangs: ['en'] }),
    )
  })

  it('registers a summary-translation task handler', () => {
    const harness = createService()
    harness.service.onModuleInit()
    const types = harness.taskProcessor.registerHandler.mock.calls.map(
      ([registered]: any[]) => registered.type,
    )
    expect(types).toContain(AITaskType.SummaryTranslation)
  })
})
