import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { BizException } from '~/common/exceptions/biz.exception'
import type { AiSummaryRepository } from '~/modules/ai/ai-summary/ai-summary.repository'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'

const createService = () => {
  const repository = createPgRepositoryMock<AiSummaryRepository>()
  const databaseService = { findGlobalById: vi.fn(), findGlobalByIds: vi.fn() }
  const configService = { get: vi.fn() }
  const aiService = {}
  const aiInFlightService = {}
  const taskProcessor = { registerHandler: vi.fn() }
  const aiTaskService = {}
  const service = new AiSummaryService(
    repository as any,
    databaseService as any,
    configService as any,
    aiService as any,
    aiInFlightService as any,
    taskProcessor as any,
    aiTaskService as any,
  )
  return { databaseService, repository, service, taskProcessor }
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
      BizException,
    )
  })

  it('deletes summaries by article id through the PG repository', async () => {
    const { repository, service } = createService()
    repository.deleteForRef.mockResolvedValue(1)

    await service.deleteSummaryByArticleId('post-1')

    expect(repository.deleteForRef).toHaveBeenCalledWith('post-1')
  })
})
