import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock } from '@/helper/pg-repository-mock'
import type { AiInsightsRepository } from '~/modules/ai/ai-insights/ai-insights.repository'
import { AiInsightsTranslationService } from '~/modules/ai/ai-insights/ai-insights-translation.service'

const createService = () => {
  const repository = createPgRepositoryMock<AiInsightsRepository>()
  const configService = {
    get: vi.fn().mockResolvedValue({
      enableInsights: true,
      enableAutoTranslateInsights: true,
      insightsTargetLanguages: ['en', 'ja', 'zh'],
    }),
  }
  const aiService = {}
  const aiInFlightService = {}
  const taskProcessor = { registerHandler: vi.fn() }
  const aiTaskService = { createInsightsTranslationTask: vi.fn() }
  const service = new AiInsightsTranslationService(
    repository as any,
    configService as any,
    aiService as any,
    aiInFlightService as any,
    taskProcessor as any,
    aiTaskService as any,
  )
  return { aiTaskService, configService, repository, service }
}

describe('AiInsightsTranslationService', () => {
  it('creates translation tasks for configured target languages except the source language', async () => {
    const { aiTaskService, repository, service } = createService()
    repository.findByRefAndLang.mockResolvedValue(null)

    await service.handleInsightsGenerated({
      refId: 'post-1',
      sourceLang: 'zh',
      insightsId: 'insights-1',
      sourceHash: 'hash-1',
    })

    expect(aiTaskService.createInsightsTranslationTask).toHaveBeenCalledTimes(2)
    expect(aiTaskService.createInsightsTranslationTask).toHaveBeenCalledWith({
      refId: 'post-1',
      sourceInsightsId: 'insights-1',
      targetLang: 'en',
    })
  })

  it('does not create duplicate tasks when the existing translation hash is current', async () => {
    const { aiTaskService, repository, service } = createService()
    repository.findByRefAndLang.mockResolvedValue({ hash: 'hash-1' } as any)

    await service.handleInsightsGenerated({
      refId: 'post-1',
      sourceLang: 'zh',
      insightsId: 'insights-1',
      sourceHash: 'hash-1',
    })

    expect(aiTaskService.createInsightsTranslationTask).not.toHaveBeenCalled()
  })
})
