import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { AiService } from '~/modules/ai/ai.service'
import { AiInFlightService } from '~/modules/ai/ai-inflight/ai-inflight.service'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { AITranslationModel } from '~/modules/ai/ai-translation/ai-translation.model'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import {
  LEXICAL_TRANSLATION_STRATEGY,
  MARKDOWN_TRANSLATION_STRATEGY,
} from '~/modules/ai/ai-translation/translation-strategy.interface'
import { ConfigsService } from '~/modules/configs/configs.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { TaskQueueProcessor } from '~/processors/task-queue'
import { getModelToken } from '~/transformers/model.transformer'

describe('AiTranslationService', () => {
  let service: AiTranslationService
  let mockTranslationModel: any
  let mockDatabaseService: any
  let mockConfigService: any

  const mockArticle = {
    id: 'article-1',
    title: 'Test Article',
    text: 'This is test content',
    summary: 'Test summary',
    tags: ['test'],
    meta: { lang: 'zh' },
  }

  const mockTranslation = {
    id: 'trans-1',
    refId: 'article-1',
    refType: CollectionRefTypes.Post,
    lang: 'en',
    sourceLang: 'zh',
    hash: '', // Will be set in tests
    title: 'Translated Title',
    text: 'Translated content',
    summary: 'Translated summary',
    tags: ['test'],
  }

  beforeEach(async () => {
    mockTranslationModel = {
      findOne: vi.fn(),
      find: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      deleteOne: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    }

    mockDatabaseService = {
      findGlobalById: vi.fn(),
      findGlobalByIds: vi.fn().mockResolvedValue({ posts: [], notes: [] }),
      getModelByRefType: vi.fn(),
    }

    mockConfigService = {
      get: vi.fn().mockResolvedValue({
        enableTranslation: true,
        translationTargetLanguages: ['en', 'ja'],
      }),
      waitForConfigReady: vi.fn().mockResolvedValue({
        ai: { enableTranslation: true },
      }),
    }

    const mockAiInFlightService = {
      runWithStream: vi.fn(),
    }

    const mockAiService = {
      getTranslationModelWithInfo: vi.fn(),
    }

    const mockEventManager = {
      emit: vi.fn(),
    }

    const mockTaskProcessor = {
      registerHandler: vi.fn(),
    }

    const mockAiTaskService = {
      crud: { createTask: vi.fn() },
      createTranslationTask: vi.fn(),
    }

    const mockLexicalStrategy = { translate: vi.fn() }
    const mockMarkdownStrategy = { translate: vi.fn() }

    const module = await Test.createTestingModule({
      providers: [
        AiTranslationService,
        {
          provide: getModelToken(AITranslationModel.name),
          useValue: mockTranslationModel,
        },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigsService, useValue: mockConfigService },
        { provide: AiService, useValue: mockAiService },
        { provide: AiInFlightService, useValue: mockAiInFlightService },
        { provide: EventManagerService, useValue: mockEventManager },
        { provide: TaskQueueProcessor, useValue: mockTaskProcessor },
        {
          provide: LexicalService,
          useValue: {
            lexicalToMarkdown: vi.fn().mockReturnValue(''),
            extractRootBlocks: vi.fn((content: string) => {
              try {
                const parsed = JSON.parse(content)
                const children = parsed?.root?.children ?? []
                return children.map((child: any, index: number) => ({
                  id: child?.$?.blockId ?? '',
                  type: child?.type ?? 'unknown',
                  text: '',
                  fingerprint: `fp_${index}`,
                  index,
                }))
              } catch {
                return []
              }
            }),
          },
        },
        { provide: AiTaskService, useValue: mockAiTaskService },
        {
          provide: LEXICAL_TRANSLATION_STRATEGY,
          useValue: mockLexicalStrategy,
        },
        {
          provide: MARKDOWN_TRANSLATION_STRATEGY,
          useValue: mockMarkdownStrategy,
        },
      ],
    }).compile()

    service = module.get(AiTranslationService)
  })

  describe('findValidTranslation', () => {
    it('should return translation when hash matches', async () => {
      const document = {
        title: mockArticle.title,
        text: mockArticle.text,
        summary: mockArticle.summary,
        tags: mockArticle.tags,
        meta: mockArticle.meta,
      }

      // Compute expected hash using the same logic as service
      const expectedHash = service.computeContentHash(
        service.toArticleContent(document),
        'zh',
      )

      const translationWithHash = { ...mockTranslation, hash: expectedHash }
      mockTranslationModel.findOne.mockResolvedValue(translationWithHash)

      const result = await (service as any).findValidTranslation(
        'article-1',
        'en',
        document,
      )

      expect(result).toEqual(translationWithHash)
      expect(mockTranslationModel.findOne).toHaveBeenCalledWith({
        refId: 'article-1',
        lang: 'en',
      })
    })

    it('should return null when hash does not match', async () => {
      const document = {
        title: mockArticle.title,
        text: mockArticle.text,
        summary: mockArticle.summary,
        tags: mockArticle.tags,
        meta: mockArticle.meta,
      }

      const translationWithWrongHash = {
        ...mockTranslation,
        hash: 'wrong-hash',
        sourceLang: 'zh',
      }
      mockTranslationModel.findOne.mockResolvedValue(translationWithWrongHash)

      const result = await (service as any).findValidTranslation(
        'article-1',
        'en',
        document,
      )

      expect(result).toBeNull()
    })

    it('should return null when no translation exists', async () => {
      mockTranslationModel.findOne.mockResolvedValue(null)

      const result = await (service as any).findValidTranslation(
        'article-1',
        'en',
        { title: 'Test', text: 'content' },
      )

      expect(result).toBeNull()
    })
  })

  describe('getValidTranslationsForArticles', () => {
    it('should validate by sourceModified when available', async () => {
      const articleModified = new Date('2024-01-01T00:00:00.000Z')
      const translationModified = new Date('2024-01-02T00:00:00.000Z')
      const translations = [
        {
          ...mockTranslation,
          refId: 'article-1',
          sourceModified: translationModified,
        },
      ]

      const query = {
        select: vi.fn().mockReturnThis(),
        then: (resolve: (value: any) => void, reject: (reason?: any) => void) =>
          Promise.resolve(translations).then(resolve, reject),
      }

      mockTranslationModel.find.mockReturnValue(query)

      const result = await service.getValidTranslationsForArticles(
        [
          {
            id: 'article-1',
            title: mockArticle.title,
            text: '',
            modified: articleModified,
          },
        ],
        'en',
      )

      expect(result.get('article-1')).toEqual(translations[0])
    })

    it('should apply select fields when provided', async () => {
      const translations = [mockTranslation]
      const query = {
        select: vi.fn().mockReturnThis(),
        then: (resolve: (value: any) => void, reject: (reason?: any) => void) =>
          Promise.resolve(translations).then(resolve, reject),
      }

      mockTranslationModel.find.mockReturnValue(query)

      await service.getValidTranslationsForArticles(
        [
          {
            id: 'article-1',
            title: mockArticle.title,
            text: mockArticle.text,
          },
        ],
        'en',
        { select: 'refId title' },
      )

      expect(query.select).toHaveBeenCalledTimes(1)
      const selectArg = query.select.mock.calls[0][0] as string
      expect(selectArg).toContain('refId')
      expect(selectArg).toContain('title')
      expect(selectArg).toContain('hash')
      expect(selectArg).toContain('sourceLang')
      expect(selectArg).toContain('sourceModified')
    })
  })

  describe('wrapAsImmediateStream', () => {
    it('should return correct stream format with done event', async () => {
      const translation = { ...mockTranslation, id: 'trans-123' }
      const { events, result } = (service as any).wrapAsImmediateStream(
        translation,
      )

      const collectedEvents: any[] = []
      for await (const event of events) {
        collectedEvents.push(event)
      }

      expect(collectedEvents).toHaveLength(1)
      expect(collectedEvents[0]).toEqual({
        type: 'done',
        data: { resultId: 'trans-123' },
      })

      const resolvedResult = await result
      expect(resolvedResult).toEqual(translation)
    })
  })

  describe('streamTranslationForArticle', () => {
    it('should return cached translation when valid translation exists', async () => {
      const document = {
        title: mockArticle.title,
        text: mockArticle.text,
        summary: mockArticle.summary,
        tags: mockArticle.tags,
        meta: mockArticle.meta,
      }

      const expectedHash = service.computeContentHash(
        service.toArticleContent(document),
        'zh',
      )

      const existingTranslation = {
        ...mockTranslation,
        id: 'cached-trans',
        hash: expectedHash,
      }

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.findOne.mockResolvedValue(existingTranslation)

      const { events, result } = await service.streamTranslationForArticle(
        'article-1',
        'en',
      )

      const collectedEvents: any[] = []
      for await (const event of events) {
        collectedEvents.push(event)
      }

      expect(collectedEvents).toHaveLength(1)
      expect(collectedEvents[0].type).toBe('done')
      expect(collectedEvents[0].data.resultId).toBe('cached-trans')

      const resolvedResult = await result
      expect(resolvedResult.id).toBe('cached-trans')
    })
  })

  describe('resolveArticleForTranslation', () => {
    it('should return document and type for valid article', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: mockArticle,
        type: CollectionRefTypes.Post,
      })

      const result = await (service as any).resolveArticleForTranslation(
        'article-1',
      )

      expect(result.document).toEqual(mockArticle)
      expect(result.type).toBe(CollectionRefTypes.Post)
    })

    it('should throw when article not found', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue(null)

      await expect(
        (service as any).resolveArticleForTranslation('not-found'),
      ).rejects.toThrow()
    })

    it('should throw for Recently type', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: mockArticle,
        type: CollectionRefTypes.Recently,
      })

      await expect(
        (service as any).resolveArticleForTranslation('article-1'),
      ).rejects.toThrow()
    })
  })

  describe('buildSourceSnapshots', () => {
    it('should return undefined for non-lexical content', () => {
      const content = { title: 'test', text: 'text' }
      const result = (service as any).buildSourceSnapshots(content)
      expect(result).toBeUndefined()
    })

    it('should extract block snapshots for lexical content', () => {
      const editorState = JSON.stringify({
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Hello' }],
              $: { blockId: 'a1' },
            },
            {
              type: 'heading',
              children: [{ type: 'text', text: 'Title' }],
              $: { blockId: 'b2' },
            },
          ],
          type: 'root',
        },
      })
      const content = {
        title: 'test',
        text: 'text',
        contentFormat: 'lexical',
        content: editorState,
      }
      const result = (service as any).buildSourceSnapshots(content)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('a1')
      expect(result[0].type).toBe('paragraph')
      expect(result[0].index).toBe(0)
      expect(result[1].id).toBe('b2')
      expect(result[1].index).toBe(1)
      expect(typeof result[0].fingerprint).toBe('string')
    })
  })

  describe('buildSourceMetaHashes', () => {
    it('should hash title, summary and tags', () => {
      const content = {
        title: 'Test Title',
        text: '',
        summary: 'A summary',
        tags: ['a', 'b'],
      }
      const result = (service as any).buildSourceMetaHashes(content)
      expect(result.title).toBeTruthy()
      expect(result.summary).toBeTruthy()
      expect(result.tags).toBeTruthy()
    })

    it('should omit summary and tags when absent', () => {
      const content = { title: 'Test', text: '' }
      const result = (service as any).buildSourceMetaHashes(content)
      expect(result.title).toBeTruthy()
      expect(result.summary).toBeUndefined()
      expect(result.tags).toBeUndefined()
    })
  })

  // parseModelJson is now in BaseTranslationStrategy and tested via strategy tests
})
