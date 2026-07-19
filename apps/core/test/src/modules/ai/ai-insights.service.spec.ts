import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppException } from '~/common/errors/exception.types'
import { CollectionRefTypes } from '~/constants/db.constant'
import type { AiInsightsRepository } from '~/modules/ai/ai-insights/ai-insights.repository'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'

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
  const configService = { get: vi.fn() }
  const aiService = {}
  const aiInFlightService = {}
  const taskProcessor = { registerHandler: vi.fn() }
  const aiTaskService = { createInsightsTask: vi.fn() }
  const eventEmitter = { emit: vi.fn() }
  const service = new AiInsightsService(
    repository as any,
    databaseService as any,
    configService as any,
    aiService as any,
    aiInFlightService as any,
    taskProcessor as any,
    aiTaskService as any,
    eventEmitter as any,
  )
  return { aiTaskService, configService, databaseService, repository, service }
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
        insights: [row],
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
})
