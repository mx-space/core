import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AiService } from '~/modules/ai/ai.service'
import { AiInFlightService } from '~/modules/ai/ai-inflight/ai-inflight.service'
import { AIInsightsModel } from '~/modules/ai/ai-insights/ai-insights.model'
import { AiInsightsTranslationService } from '~/modules/ai/ai-insights/ai-insights-translation.service'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { TaskQueueProcessor } from '~/processors/task-queue'
import { getModelToken } from '~/transformers/model.transformer'

describe('AiInsightsTranslationService', () => {
  let service: AiInsightsTranslationService
  let mockModel: any
  let mockTaskService: any
  let mockConfigService: any

  beforeEach(async () => {
    mockModel = {
      findById: vi.fn(),
      findOne: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    }
    mockTaskService = {
      createInsightsTranslationTask: vi.fn(),
    }
    mockConfigService = {
      get: vi.fn().mockResolvedValue({
        enableInsights: true,
        enableAutoTranslateInsights: true,
        insightsTargetLanguages: ['en', 'ja', 'zh'],
      }),
    }
    const module = await Test.createTestingModule({
      providers: [
        AiInsightsTranslationService,
        { provide: getModelToken(AIInsightsModel.name), useValue: mockModel },
        { provide: ConfigsService, useValue: mockConfigService },
        {
          provide: AiService,
          useValue: { getInsightsTranslationModel: vi.fn() },
        },
        { provide: AiInFlightService, useValue: { runWithStream: vi.fn() } },
        {
          provide: TaskQueueProcessor,
          useValue: { registerHandler: vi.fn() },
        },
        { provide: AiTaskService, useValue: mockTaskService },
      ],
    }).compile()
    service = module.get(AiInsightsTranslationService)
  })

  it('handleInsightsGenerated enqueues tasks for non-source targets', async () => {
    mockModel.findOne.mockResolvedValue(null)
    await service.handleInsightsGenerated({
      refId: 'a',
      sourceLang: 'zh',
      insightsId: 'ins-1',
      sourceHash: 'h1',
    })
    expect(mockTaskService.createInsightsTranslationTask).toHaveBeenCalledTimes(
      2,
    )
    expect(mockTaskService.createInsightsTranslationTask).toHaveBeenCalledWith({
      refId: 'a',
      sourceInsightsId: 'ins-1',
      targetLang: 'en',
    })
    expect(mockTaskService.createInsightsTranslationTask).toHaveBeenCalledWith({
      refId: 'a',
      sourceInsightsId: 'ins-1',
      targetLang: 'ja',
    })
  })

  it('handleInsightsGenerated skips languages with fresh cache', async () => {
    mockModel.findOne.mockImplementation(async (q: any) =>
      q.lang === 'en' ? { id: 'x' } : null,
    )
    await service.handleInsightsGenerated({
      refId: 'a',
      sourceLang: 'zh',
      insightsId: 'ins-1',
      sourceHash: 'h1',
    })
    expect(mockTaskService.createInsightsTranslationTask).toHaveBeenCalledTimes(
      1,
    )
  })

  it('handleInsightsGenerated does nothing when auto-translate is off', async () => {
    mockConfigService.get.mockResolvedValue({
      enableInsights: true,
      enableAutoTranslateInsights: false,
      insightsTargetLanguages: ['en'],
    })
    await service.handleInsightsGenerated({
      refId: 'a',
      sourceLang: 'zh',
      insightsId: 'ins-1',
      sourceHash: 'h1',
    })
    expect(mockTaskService.createInsightsTranslationTask).not.toHaveBeenCalled()
  })
})
