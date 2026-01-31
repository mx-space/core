import { Test } from '@nestjs/testing'
import { CollectionRefTypes } from '~/constants/db.constant'
import { AiInFlightService } from '~/modules/ai/ai-inflight/ai-inflight.service'
import { AISummaryModel } from '~/modules/ai/ai-summary/ai-summary.model'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'
import { AiService } from '~/modules/ai/ai.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { DatabaseService } from '~/processors/database/database.service'
import { TaskQueueProcessor } from '~/processors/task-queue'
import { getModelToken } from '~/transformers/model.transformer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('AiSummaryService', () => {
  let service: AiSummaryService
  let mockSummaryModel: any
  let mockDatabaseService: any
  let mockConfigService: any

  const mockArticle = {
    id: 'article-1',
    title: 'Test Article',
    text: 'This is test content for summary',
  }

  const mockSummary = {
    id: 'summary-1',
    refId: 'article-1',
    lang: 'zh',
    summary: 'This is a test summary',
    hash: '', // Will be set in tests
  }

  beforeEach(async () => {
    mockSummaryModel = {
      findOne: vi.fn(),
      find: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      deleteOne: vi.fn(),
      deleteMany: vi.fn(),
      paginate: vi.fn(),
      aggregate: vi.fn(),
    }

    mockDatabaseService = {
      findGlobalById: vi.fn(),
      findGlobalByIds: vi.fn().mockResolvedValue({ posts: [], notes: [] }),
      getModelByRefType: vi.fn(),
    }

    mockConfigService = {
      get: vi.fn().mockResolvedValue({
        enableSummary: true,
        enableAutoGenerateSummary: true,
        aiSummaryTargetLanguage: 'zh',
      }),
      waitForConfigReady: vi.fn().mockResolvedValue({
        ai: { enableSummary: true },
      }),
    }

    const mockAiInFlightService = {
      runWithStream: vi.fn(),
    }

    const mockAiService = {
      getSummaryModel: vi.fn(),
    }

    const mockTaskProcessor = {
      registerHandler: vi.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [
        AiSummaryService,
        {
          provide: getModelToken(AISummaryModel.name),
          useValue: mockSummaryModel,
        },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigsService, useValue: mockConfigService },
        { provide: AiService, useValue: mockAiService },
        { provide: AiInFlightService, useValue: mockAiInFlightService },
        { provide: TaskQueueProcessor, useValue: mockTaskProcessor },
      ],
    }).compile()

    service = module.get(AiSummaryService)
  })

  describe('findValidSummary', () => {
    it('should return summary when hash matches', async () => {
      const text = mockArticle.text
      // Use the service's internal method to compute hash
      const expectedHash = (service as any).computeContentHash(text)

      const summaryWithHash = { ...mockSummary, hash: expectedHash }
      mockSummaryModel.findOne.mockResolvedValue(summaryWithHash)

      const result = await (service as any).findValidSummary(
        'article-1',
        'zh',
        text,
      )

      expect(result).toEqual(summaryWithHash)
      expect(mockSummaryModel.findOne).toHaveBeenCalledWith({
        refId: 'article-1',
        lang: 'zh',
        hash: expectedHash,
      })
    })

    it('should return null when no summary exists', async () => {
      mockSummaryModel.findOne.mockResolvedValue(null)

      const result = await (service as any).findValidSummary(
        'article-1',
        'zh',
        'some text',
      )

      expect(result).toBeNull()
    })
  })

  describe('wrapAsImmediateStream', () => {
    it('should return correct stream format with done event', async () => {
      const summary = { ...mockSummary, id: 'summary-123' }
      const { events, result } = (service as any).wrapAsImmediateStream(summary)

      const collectedEvents: any[] = []
      for await (const event of events) {
        collectedEvents.push(event)
      }

      expect(collectedEvents).toHaveLength(1)
      expect(collectedEvents[0]).toEqual({
        type: 'done',
        data: { resultId: 'summary-123' },
      })

      const resolvedResult = await result
      expect(resolvedResult).toEqual(summary)
    })
  })

  describe('streamSummaryForArticle', () => {
    it('should return cached summary when valid summary exists', async () => {
      const text = mockArticle.text
      const expectedHash = (service as any).computeContentHash(text)

      const existingSummary = {
        ...mockSummary,
        id: 'cached-summary',
        hash: expectedHash,
      }

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: mockArticle,
        type: CollectionRefTypes.Post,
      })
      mockSummaryModel.findOne.mockResolvedValue(existingSummary)

      const { events, result } = await service.streamSummaryForArticle(
        'article-1',
        { preferredLang: 'zh' },
      )

      const collectedEvents: any[] = []
      for await (const event of events) {
        collectedEvents.push(event)
      }

      expect(collectedEvents).toHaveLength(1)
      expect(collectedEvents[0].type).toBe('done')
      expect(collectedEvents[0].data.resultId).toBe('cached-summary')

      const resolvedResult = await result
      expect(resolvedResult.id).toBe('cached-summary')
    })
  })

  describe('resolveArticleForSummary', () => {
    it('should return document and type for valid article', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: mockArticle,
        type: CollectionRefTypes.Post,
      })

      const result = await (service as any).resolveArticleForSummary(
        'article-1',
      )

      expect(result.document).toEqual(mockArticle)
      expect(result.type).toBe(CollectionRefTypes.Post)
    })

    it('should throw when article not found', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue(null)

      await expect(
        (service as any).resolveArticleForSummary('not-found'),
      ).rejects.toThrow()
    })

    it('should throw for Recently type', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: mockArticle,
        type: CollectionRefTypes.Recently,
      })

      await expect(
        (service as any).resolveArticleForSummary('article-1'),
      ).rejects.toThrow()
    })
  })

  describe('getTargetLanguage', () => {
    it('should use preferredLang when provided', async () => {
      mockConfigService.get.mockResolvedValue({
        aiSummaryTargetLanguage: 'auto',
      })

      const result = await (service as any).getTargetLanguage({
        preferredLang: 'ja',
      })

      expect(result).toBe('ja')
    })

    it('should use acceptLanguage when preferredLang not provided', async () => {
      mockConfigService.get.mockResolvedValue({
        aiSummaryTargetLanguage: 'auto',
      })

      const result = await (service as any).getTargetLanguage({
        acceptLanguage: 'en-US',
      })

      expect(result).toBe('en')
    })

    it('should use configured language when not auto', async () => {
      mockConfigService.get.mockResolvedValue({
        aiSummaryTargetLanguage: 'ko',
      })

      const result = await (service as any).getTargetLanguage({
        preferredLang: 'ja',
      })

      expect(result).toBe('ko')
    })

    it('should fallback to default when no language provided and auto mode', async () => {
      mockConfigService.get.mockResolvedValue({
        aiSummaryTargetLanguage: 'auto',
      })

      const result = await (service as any).getTargetLanguage({})

      expect(result).toBe('zh') // DEFAULT_SUMMARY_LANG
    })
  })

  describe('getSummaryByArticleId', () => {
    it('should return valid summary from database', async () => {
      const text = mockArticle.text
      const expectedHash = (service as any).computeContentHash(text)

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: mockArticle,
        type: CollectionRefTypes.Post,
      })

      const existingSummary = { ...mockSummary, hash: expectedHash }
      mockSummaryModel.findOne.mockResolvedValue(existingSummary)

      const result = await service.getSummaryByArticleId('article-1', 'zh')

      expect(result).toEqual(existingSummary)
    })

    it('should return null when hash does not match', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: mockArticle,
        type: CollectionRefTypes.Post,
      })

      mockSummaryModel.findOne.mockResolvedValue(null)

      const result = await service.getSummaryByArticleId('article-1', 'zh')

      expect(result).toBeNull()
    })
  })
})
