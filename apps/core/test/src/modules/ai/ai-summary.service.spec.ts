import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppException } from '~/common/errors/exception.types'
import { CollectionRefTypes } from '~/constants/db.constant'
import type { AiSummaryRepository } from '~/modules/ai/ai-summary/ai-summary.repository'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'

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
  const configService = { get: vi.fn() }
  const aiService = {}
  const aiInFlightService = {}
  const taskProcessor = { registerHandler: vi.fn() }
  const aiTaskService = { createSummaryTask: vi.fn() }
  const service = new AiSummaryService(
    repository as any,
    databaseService as any,
    configService as any,
    aiService as any,
    aiInFlightService as any,
    taskProcessor as any,
    aiTaskService as any,
  )
  return { aiTaskService, configService, databaseService, repository, service }
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
    const { repository, service } = createService()
    repository.deleteForRef.mockResolvedValue(1)

    await service.deleteSummaryByArticleId('post-1')

    expect(repository.deleteForRef).toHaveBeenCalledWith('post-1')
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

  it('creates an initial summary task on update when no summaries exist', async () => {
    const { aiTaskService, configService, databaseService, repository, service } =
      createService()
    configService.get.mockResolvedValue({
      enableSummary: true,
      enableAutoGenerateSummaryOnUpdate: true,
      summaryTargetLanguages: ['en', 'ja'],
      summaryMinTextLength: 0,
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
    repository.listForRef.mockResolvedValue([])

    await service.handleUpdateArticle({ id: 'post-1' })

    expect(aiTaskService.createSummaryTask).toHaveBeenCalledWith({
      refId: 'post-1',
      targetLanguages: ['en', 'ja'],
    })
  })
})
