import { Test } from '@nestjs/testing'
import { BizException } from '~/common/exceptions/biz.exception'
import { AiService } from '~/modules/ai/ai.service'
import { AIProviderType } from '~/modules/ai/ai.types'
import { ConfigsService } from '~/modules/configs/configs.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the factory
vi.mock('~/modules/ai/ai-provider.factory', () => ({
  createLanguageModel: vi.fn((config, modelOverride) => ({
    id: `${config.type}:${modelOverride || config.defaultModel}`,
    providerId: config.id,
  })),
}))

describe('AiService', () => {
  let service: AiService
  let configsService: { get: ReturnType<typeof vi.fn> }

  const mockAiConfig = {
    providers: [
      {
        id: 'main',
        name: 'Main OpenAI',
        type: AIProviderType.OpenAI,
        apiKey: 'sk-xxx',
        defaultModel: 'gpt-4o',
        enabled: true,
      },
      {
        id: 'backup',
        name: 'Backup',
        type: AIProviderType.OpenAI,
        apiKey: 'sk-yyy',
        defaultModel: 'gpt-4o-mini',
        enabled: true,
      },
      {
        id: 'disabled',
        name: 'Disabled Provider',
        type: AIProviderType.OpenAI,
        apiKey: 'sk-zzz',
        defaultModel: 'gpt-3.5-turbo',
        enabled: false,
      },
    ],
    summaryModel: { providerId: 'main' },
    writerModel: { providerId: 'backup', model: 'gpt-4o-mini' },
    commentReviewModel: { providerId: 'main' },
    enableSummary: true,
  }

  beforeEach(async () => {
    configsService = {
      get: vi.fn().mockResolvedValue(mockAiConfig),
    }

    const module = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigsService,
          useValue: configsService,
        },
      ],
    }).compile()

    service = module.get(AiService)
  })

  describe('getSummaryModel', () => {
    it('should get summary model from assigned provider', async () => {
      const model = (await service.getSummaryModel()) as any
      expect(model).toBeDefined()
      expect(model.providerId).toBe('main')
      expect(model.id).toBe('openai:gpt-4o')
    })
  })

  describe('getWriterModel', () => {
    it('should get writer model with overridden model name', async () => {
      const model = (await service.getWriterModel()) as any
      expect(model).toBeDefined()
      expect(model.providerId).toBe('backup')
      expect(model.id).toBe('openai:gpt-4o-mini')
    })
  })

  describe('getCommentReviewModel', () => {
    it('should get comment review model from assigned provider', async () => {
      const model = (await service.getCommentReviewModel()) as any
      expect(model).toBeDefined()
      expect(model.providerId).toBe('main')
    })
  })

  describe('when no providers configured', () => {
    it('should throw when providers array is empty', async () => {
      configsService.get.mockResolvedValueOnce({ providers: [] })
      await expect(service.getSummaryModel()).rejects.toThrow(BizException)
    })

    it('should throw when providers is undefined', async () => {
      configsService.get.mockResolvedValueOnce({})
      await expect(service.getSummaryModel()).rejects.toThrow(BizException)
    })
  })

  describe('fallback behavior', () => {
    it('should fallback to first enabled provider when assigned provider not found', async () => {
      configsService.get.mockResolvedValueOnce({
        ...mockAiConfig,
        summaryModel: { providerId: 'non-existent' },
      })
      const model = (await service.getSummaryModel()) as any
      expect(model).toBeDefined()
      expect(model.providerId).toBe('main')
    })

    it('should fallback to first enabled provider when no assignment', async () => {
      configsService.get.mockResolvedValueOnce({
        ...mockAiConfig,
        summaryModel: undefined,
      })
      const model = (await service.getSummaryModel()) as any
      expect(model).toBeDefined()
      expect(model.providerId).toBe('main')
    })

    it('should skip disabled providers in fallback', async () => {
      configsService.get.mockResolvedValueOnce({
        providers: [
          {
            id: 'disabled-first',
            name: 'Disabled First',
            type: AIProviderType.OpenAI,
            apiKey: 'sk-xxx',
            defaultModel: 'gpt-4o',
            enabled: false,
          },
          {
            id: 'enabled-second',
            name: 'Enabled Second',
            type: AIProviderType.OpenAI,
            apiKey: 'sk-yyy',
            defaultModel: 'gpt-4o-mini',
            enabled: true,
          },
        ],
        summaryModel: undefined,
      })
      const model = (await service.getSummaryModel()) as any
      expect(model.providerId).toBe('enabled-second')
    })
  })
})
