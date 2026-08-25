import { describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock } from '@/helper/pg-repository-mock'
import { AiInsightsAdapter } from '~/modules/ai/ai-insights/ai-insights.adapter'
import type { AiInsightsRepository } from '~/modules/ai/ai-insights/ai-insights.repository'
import { AiInsightsTranslationService } from '~/modules/ai/ai-insights/ai-insights-translation.service'
import { MultilangGenerationService } from '~/modules/ai/ai-multilang/ai-multilang.service'

const createService = () => {
  const repository = createPgRepositoryMock<AiInsightsRepository>()
  const configService = {
    get: vi.fn().mockResolvedValue({
      enableInsights: true,
      enableAutoTranslateInsights: true,
      insightsTargetLanguages: ['en', 'ja', 'zh'],
    }),
    waitForConfigReady: vi
      .fn()
      .mockResolvedValue({ ai: { enableInsights: true } }),
  }
  const aiService = {
    getInsightsModel: vi.fn(),
    getInsightsTranslationModel: vi.fn(),
  }
  const databaseService = { findGlobalById: vi.fn() }
  const eventEmitter = { emit: vi.fn() }
  const aiInFlightService = {
    runWithStream: vi.fn(async () => ({
      events: (async function* () {})(),
      result: Promise.resolve({ id: 'translated-1' }),
    })),
  }
  const taskProcessor = { registerHandler: vi.fn() }
  const aiTaskService = { createInsightsTranslationTask: vi.fn() }
  const generationMetrics = {
    record: vi.fn().mockResolvedValue(undefined),
  }
  const adapter = new AiInsightsAdapter(
    repository as any,
    databaseService as any,
    configService as any,
    aiService as any,
    eventEmitter as any,
    { isPremiumLocked: vi.fn(async () => false) } as any,
  )
  const multilang = new MultilangGenerationService(
    aiInFlightService as any,
    generationMetrics as any,
    configService as any,
  )
  const service = new AiInsightsTranslationService(
    repository as any,
    configService as any,
    adapter,
    multilang,
    taskProcessor as any,
    aiTaskService as any,
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
    repository.findByRefAndLang.mockResolvedValue(null)

    await service.translateInsights({
      refId: 'post-1',
      sourceInsightsId: 'insights-1',
      targetLang: 'en',
    })

    expect(aiInFlightService.runWithStream).toHaveBeenCalledWith(
      expect.objectContaining({ bypassResultCache: undefined }),
    )
  })

  it('returns the existing translation without re-running when its hash matches the base', async () => {
    const { aiInFlightService, repository, service } = createService()
    repository.findById.mockResolvedValue(source as any)
    repository.findByRefAndLang.mockResolvedValue({
      id: 'translated-en',
      lang: 'en',
      hash: 'hash-1',
      content: 'existing',
      isTranslation: true,
      sourceLang: 'zh',
    } as any)

    const result = await service.translateInsights({
      refId: 'post-1',
      sourceInsightsId: 'insights-1',
      targetLang: 'en',
    })

    expect(result).toMatchObject({ id: 'translated-en' })
    expect(aiInFlightService.runWithStream).not.toHaveBeenCalled()
  })
})
