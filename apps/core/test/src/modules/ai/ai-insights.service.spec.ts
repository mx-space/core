import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppException } from '~/common/errors/exception.types'
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
    findGlobalByIds: vi.fn().mockResolvedValue({ notes: [], posts: [] }),
  }
  const configService = { get: vi.fn() }
  const aiService = {}
  const aiInFlightService = {}
  const taskProcessor = { registerHandler: vi.fn() }
  const aiTaskService = {}
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
  return { databaseService, repository, service }
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
    repository.listByRefIds.mockResolvedValue([row] as any)
    databaseService.findGlobalByIds.mockResolvedValue({
      notes: [],
      posts: [{ id: 'post-1', title: 'Post' }],
    })

    await expect(
      service.getAllInsightsGrouped({ page: 1, size: 10 }),
    ).resolves.toMatchObject({
      data: [{ article: { id: 'post-1', title: 'Post' } }],
      pagination: { total: 1, currentPage: 1, size: 10 },
    })
  })
})
