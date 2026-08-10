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
  const aiInFlightService = {
    runWithStream: vi.fn(async () => ({
      result: Promise.resolve({ id: 'translated-1' }),
    })),
  }
  const taskProcessor = { registerHandler: vi.fn() }
  const aiTaskService = { createInsightsTranslationTask: vi.fn() }
  const generationMetrics = {
    record: vi.fn().mockResolvedValue(undefined),
  }
  const service = new AiInsightsTranslationService(
    repository as any,
    configService as any,
    aiService as any,
    aiInFlightService as any,
    taskProcessor as any,
    aiTaskService as any,
    generationMetrics as any,
  )
  return {
    aiInFlightService,
    aiTaskService,
    configService,
    generationMetrics,
    repository,
    service,
  }
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

  it('canonicalizes configured targets before diffing them against the source language', async () => {
    const { aiTaskService, configService, repository, service } =
      createService()
    configService.get.mockResolvedValue({
      enableInsights: true,
      enableAutoTranslateInsights: true,
      insightsTargetLanguages: ['zh-CN', 'jp', 'ja'],
    })
    repository.findByRefAndLang.mockResolvedValue(null)

    await service.handleInsightsGenerated({
      refId: 'post-1',
      sourceLang: 'zh',
      insightsId: 'insights-1',
      sourceHash: 'hash-1',
    })

    expect(aiTaskService.createInsightsTranslationTask).toHaveBeenCalledTimes(1)
    expect(aiTaskService.createInsightsTranslationTask).toHaveBeenCalledWith({
      refId: 'post-1',
      sourceInsightsId: 'insights-1',
      targetLang: 'ja',
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

describe('AiInsightsTranslationService.translateInsights — force', () => {
  const source = {
    id: 'insights-1',
    refId: 'post-1',
    lang: 'zh',
    hash: 'hash-1',
    content: 'insight',
    isTranslation: false,
    sourceLang: 'zh',
  }

  it('bypasses the in-flight result cache when the request is forced', async () => {
    const { aiInFlightService, repository, service } = createService()
    repository.findById.mockResolvedValue(source as any)

    await service.translateInsights({
      refId: 'post-1',
      sourceInsightsId: 'insights-1',
      targetLang: 'en',
      force: true,
    })

    expect(aiInFlightService.runWithStream).toHaveBeenCalledWith(
      expect.objectContaining({ bypassResultCache: true }),
    )
  })

  it('reuses the cached result for an ordinary request', async () => {
    const { aiInFlightService, repository, service } = createService()
    repository.findById.mockResolvedValue(source as any)

    await service.translateInsights({
      refId: 'post-1',
      sourceInsightsId: 'insights-1',
      targetLang: 'en',
    })

    expect(aiInFlightService.runWithStream).toHaveBeenCalledWith(
      expect.objectContaining({ bypassResultCache: undefined }),
    )
  })
})
