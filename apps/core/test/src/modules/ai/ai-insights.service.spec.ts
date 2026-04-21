import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { AiService } from '~/modules/ai/ai.service'
import { AiInFlightService } from '~/modules/ai/ai-inflight/ai-inflight.service'
import { AIInsightsModel } from '~/modules/ai/ai-insights/ai-insights.model'
import { AiInsightsService } from '~/modules/ai/ai-insights/ai-insights.service'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { DatabaseService } from '~/processors/database/database.service'
import { TaskQueueProcessor } from '~/processors/task-queue'
import { getModelToken } from '~/transformers/model.transformer'

describe('AiInsightsService', () => {
  let service: AiInsightsService
  let mockModel: any
  let mockDatabaseService: any
  let mockConfigService: any

  beforeEach(async () => {
    mockModel = {
      findOne: vi.fn(),
      find: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      deleteOne: vi.fn(),
      deleteMany: vi.fn(),
      paginate: vi.fn(),
      aggregate: vi.fn(),
      findOneAndUpdate: vi.fn(),
    }
    mockDatabaseService = {
      findGlobalById: vi.fn(),
      findGlobalByIds: vi.fn().mockResolvedValue({ posts: [], notes: [] }),
      getModelByRefType: vi.fn(),
    }
    mockConfigService = {
      get: vi.fn().mockResolvedValue({
        enableInsights: true,
        enableAutoTranslateInsights: false,
        insightsTargetLanguages: ['en'],
      }),
      waitForConfigReady: vi.fn().mockResolvedValue({
        ai: { enableInsights: true },
      }),
    }

    const module = await Test.createTestingModule({
      providers: [
        AiInsightsService,
        { provide: getModelToken(AIInsightsModel.name), useValue: mockModel },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigsService, useValue: mockConfigService },
        { provide: AiService, useValue: { getInsightsModel: vi.fn() } },
        {
          provide: AiInFlightService,
          useValue: { runWithStream: vi.fn() },
        },
        {
          provide: TaskQueueProcessor,
          useValue: { registerHandler: vi.fn() },
        },
        {
          provide: AiTaskService,
          useValue: {
            crud: { createTask: vi.fn() },
            createInsightsTask: vi.fn(),
            createInsightsTranslationTask: vi.fn(),
          },
        },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
      ],
    }).compile()

    service = module.get(AiInsightsService)
  })

  it('findValidInsights returns doc when hash matches', async () => {
    const text = 'content'
    const expectedHash = (service as any).computeContentHash(text)
    const doc = {
      id: 'x',
      refId: 'a',
      lang: 'zh',
      hash: expectedHash,
      content: 'markdown',
    }
    mockModel.findOne.mockResolvedValue(doc)

    const result = await (service as any).findValidInsights('a', 'zh', text)
    expect(result).toEqual(doc)
    expect(mockModel.findOne).toHaveBeenCalledWith({
      refId: 'a',
      lang: 'zh',
      hash: expectedHash,
    })
  })

  it('generateInsights throws when enableInsights is false', async () => {
    mockConfigService.waitForConfigReady.mockResolvedValue({
      ai: { enableInsights: false },
    })
    mockDatabaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: { title: 'T', text: 'body' },
    })
    await expect(service.generateInsights('a')).rejects.toThrow()
  })

  it('handleCreateArticle skips when auto-generate-on-create is off', async () => {
    mockConfigService.get.mockResolvedValue({
      enableInsights: true,
      enableAutoGenerateInsightsOnCreate: false,
    })
    const taskSvc: any = (service as any).aiTaskService
    await service.handleCreateArticle({ id: 'a' })
    expect(taskSvc.createInsightsTask).not.toHaveBeenCalled()
  })

  it('handleCreateArticle enqueues when enabled', async () => {
    mockConfigService.get.mockResolvedValue({
      enableInsights: true,
      enableAutoGenerateInsightsOnCreate: true,
    })
    const taskSvc: any = (service as any).aiTaskService
    await service.handleCreateArticle({ id: 'a' })
    expect(taskSvc.createInsightsTask).toHaveBeenCalledWith({ refId: 'a' })
  })

  it('handleDeleteArticle cascades', async () => {
    await service.handleDeleteArticle({ id: 'a' })
    expect(mockModel.deleteMany).toHaveBeenCalledWith({ refId: 'a' })
  })

  it('generateInsights streams and persists', async () => {
    mockDatabaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: { title: 'T', text: 'body', lang: 'zh' },
    })
    const created = {
      id: 'ins-1',
      refId: 'a',
      lang: 'zh',
      hash: (service as any).computeContentHash('body'),
      content: '## TL;DR\nhello',
    }
    mockModel.findOneAndUpdate.mockResolvedValue(created)
    const aiInFlight: any = (service as any).aiInFlightService
    aiInFlight.runWithStream.mockImplementation(async ({ onLeader }: any) => {
      const pushed: string[] = []
      const out = await onLeader({
        push: async (e: any) => {
          pushed.push(e?.data)
        },
      })
      return {
        events: (async function* () {})(),
        result: Promise.resolve(out.result),
      }
    })
    const aiSvc: any = (service as any).aiService
    aiSvc.getInsightsModel.mockResolvedValue({
      generateTextStream: async function* () {
        yield { text: '## TL;DR\n' }
        yield { text: 'hello' }
      },
    })
    const result = await service.generateInsights('a')
    expect(result).toBe(created)
    expect(mockModel.findOneAndUpdate).toHaveBeenCalled()
  })
})
