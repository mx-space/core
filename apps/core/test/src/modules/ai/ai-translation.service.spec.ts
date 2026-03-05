import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { AiService } from '~/modules/ai/ai.service'
import { AiInFlightService } from '~/modules/ai/ai-inflight/ai-inflight.service'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { AITranslationModel } from '~/modules/ai/ai-translation/ai-translation.model'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { TranslationConsistencyService } from '~/modules/ai/ai-translation/translation-consistency.service'
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
  let mockAiTaskService: any
  let mockTranslationConsistencyService: any

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
        enableAutoGenerateTranslation: true,
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

    mockAiTaskService = {
      crud: { createTask: vi.fn() },
      createTranslationTask: vi.fn(),
    }

    const mockLexicalStrategy = { translate: vi.fn() }
    const mockMarkdownStrategy = { translate: vi.fn() }
    mockTranslationConsistencyService = {
      buildValidationSelect: vi
        .fn()
        .mockImplementation((select?: string) => select || 'default-select'),
      partitionValidAndStaleTranslations: vi
        .fn()
        .mockImplementation((_articles: any[], translations: any[]) => ({
          validTranslations: new Map(
            translations.map((translation) => [translation.refId, translation]),
          ),
          staleRefIds: [],
        })),
      filterTrulyStaleTranslations: vi.fn().mockResolvedValue([]),
    }

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
          provide: TranslationConsistencyService,
          useValue: mockTranslationConsistencyService,
        },
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
    it('should delegate partitioning and return structured result', async () => {
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
      const expected = {
        validTranslations: new Map([['article-1', translations[0]]]),
        staleRefIds: ['article-2'],
      }
      mockTranslationConsistencyService.partitionValidAndStaleTranslations.mockReturnValue(
        expected,
      )

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

      expect(result).toEqual(expected)
      expect(
        mockTranslationConsistencyService.partitionValidAndStaleTranslations,
      ).toHaveBeenCalledWith(
        [
          {
            id: 'article-1',
            title: mockArticle.title,
            text: '',
            modified: articleModified,
          },
        ],
        translations,
      )
    })

    it('should apply select fields when provided', async () => {
      const translations = [mockTranslation]
      const query = {
        select: vi.fn().mockReturnThis(),
        then: (resolve: (value: any) => void, reject: (reason?: any) => void) =>
          Promise.resolve(translations).then(resolve, reject),
      }

      mockTranslationModel.find.mockReturnValue(query)
      mockTranslationConsistencyService.buildValidationSelect.mockReturnValue(
        'normalized-select',
      )

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

      expect(
        mockTranslationConsistencyService.buildValidationSelect,
      ).toHaveBeenCalledWith('refId title')
      expect(query.select).toHaveBeenCalledTimes(1)
      expect(query.select).toHaveBeenCalledWith('normalized-select')
    })

    it('should internally schedule regeneration when staleRefIds exist', async () => {
      const translations = [{ ...mockTranslation, refId: 'article-1' }]
      const query = {
        select: vi.fn().mockReturnThis(),
        then: (resolve: (value: any) => void, reject: (reason?: any) => void) =>
          Promise.resolve(translations).then(resolve, reject),
      }
      mockTranslationModel.find.mockReturnValue(query)
      mockTranslationConsistencyService.partitionValidAndStaleTranslations.mockReturnValue(
        {
          validTranslations: new Map([['article-1', translations[0]]]),
          staleRefIds: ['article-2', 'article-3'],
        },
      )

      const scheduleSpy = vi
        .spyOn(service, 'scheduleRegenerationForStaleTranslations')
        .mockResolvedValue(undefined)

      await service.getValidTranslationsForArticles(
        [
          { id: 'article-1', title: 'T1', text: '' },
          { id: 'article-2', title: 'T2', text: '' },
          { id: 'article-3', title: 'T3', text: '' },
        ],
        'en',
      )

      expect(scheduleSpy).toHaveBeenCalledWith(['article-2', 'article-3'], 'en')
      scheduleSpy.mockRestore()
    })

    it('should not schedule regeneration when no staleRefIds', async () => {
      const translations = [{ ...mockTranslation, refId: 'article-1' }]
      const query = {
        select: vi.fn().mockReturnThis(),
        then: (resolve: (value: any) => void, reject: (reason?: any) => void) =>
          Promise.resolve(translations).then(resolve, reject),
      }
      mockTranslationModel.find.mockReturnValue(query)
      mockTranslationConsistencyService.partitionValidAndStaleTranslations.mockReturnValue(
        {
          validTranslations: new Map([['article-1', translations[0]]]),
          staleRefIds: [],
        },
      )

      const scheduleSpy = vi
        .spyOn(service, 'scheduleRegenerationForStaleTranslations')
        .mockResolvedValue(undefined)

      await service.getValidTranslationsForArticles(
        [{ id: 'article-1', title: 'T1', text: '' }],
        'en',
      )

      expect(scheduleSpy).not.toHaveBeenCalled()
      scheduleSpy.mockRestore()
    })
  })

  describe('scheduleRegenerationForStaleTranslations', () => {
    it('should schedule tasks for truly stale translations only', async () => {
      const existingTranslations = [
        { refId: 'article-1', hash: 'old-1', sourceLang: 'zh' },
        { refId: 'article-2', hash: 'old-2', sourceLang: 'zh' },
      ]
      const query = {
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(existingTranslations as any),
      }
      mockTranslationModel.find.mockReturnValue(query)
      mockTranslationConsistencyService.filterTrulyStaleTranslations.mockResolvedValue(
        ['article-2'],
      )

      await service.scheduleRegenerationForStaleTranslations(
        ['article-1', 'article-2'],
        'en',
      )

      expect(query.select).toHaveBeenCalledWith('refId hash sourceLang')
      expect(
        mockTranslationConsistencyService.filterTrulyStaleTranslations,
      ).toHaveBeenCalledWith(existingTranslations)
      expect(mockAiTaskService.createTranslationTask).toHaveBeenCalledTimes(1)
      expect(mockAiTaskService.createTranslationTask).toHaveBeenCalledWith({
        refId: 'article-2',
        targetLanguages: ['en'],
      })
    })

    it('should skip scheduling when auto-generate is disabled', async () => {
      mockConfigService.get.mockResolvedValue({
        enableAutoGenerateTranslation: false,
        enableTranslation: true,
      })

      await service.scheduleRegenerationForStaleTranslations(
        ['article-1'],
        'en',
      )

      expect(mockTranslationModel.find).not.toHaveBeenCalled()
      expect(
        mockTranslationConsistencyService.filterTrulyStaleTranslations,
      ).not.toHaveBeenCalled()
      expect(mockAiTaskService.createTranslationTask).not.toHaveBeenCalled()
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

  describe('getTranslationForArticle', () => {
    it('should return translation when evaluateTranslationFreshness returns valid', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        meta: { lang: 'zh' },
        modified: new Date('2024-01-01'),
        created: new Date('2024-01-01'),
      }
      const translation = {
        ...mockTranslation,
        sourceModified: new Date('2024-01-02'),
        created: new Date('2024-01-02'),
      }

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.findOne.mockResolvedValue(translation)
      mockTranslationConsistencyService.evaluateTranslationFreshness = vi
        .fn()
        .mockReturnValue('valid')

      const result = await service.getTranslationForArticle('article-1', 'en')
      expect(result).toEqual(translation)
      expect(
        mockTranslationConsistencyService.evaluateTranslationFreshness,
      ).toHaveBeenCalledTimes(1)
    })

    it('should return null when evaluateTranslationFreshness returns stale', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        meta: { lang: 'zh' },
        modified: new Date('2024-06-01'),
      }

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.findOne.mockResolvedValue({
        ...mockTranslation,
        sourceModified: new Date('2024-01-01'),
      })
      mockTranslationConsistencyService.evaluateTranslationFreshness = vi
        .fn()
        .mockReturnValue('stale')

      const result = await service.getTranslationForArticle('article-1', 'en')
      expect(result).toBeNull()
    })

    it('should return null when no translation record exists', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: { title: 'Test', text: 'content' },
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.findOne.mockResolvedValue(null)

      const result = await service.getTranslationForArticle('article-1', 'en')
      expect(result).toBeNull()
    })

    it('should throw when article not found', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue(null)

      await expect(
        service.getTranslationForArticle('not-found', 'en'),
      ).rejects.toThrow()
    })
  })

  describe('getAvailableLanguagesForArticle', () => {
    it('should return valid languages using evaluateTranslationFreshness', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        meta: { lang: 'zh' },
        modified: new Date('2024-01-01'),
        created: new Date('2024-01-01'),
      }
      const translations = [
        {
          lang: 'en',
          hash: 'h1',
          sourceLang: 'zh',
          sourceModified: new Date('2024-01-02'),
          created: new Date('2024-01-02'),
        },
        {
          lang: 'ja',
          hash: 'h2',
          sourceLang: 'zh',
          sourceModified: new Date('2023-12-01'),
          created: new Date('2023-12-01'),
        },
      ]

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue(translations),
      })
      mockTranslationConsistencyService.evaluateTranslationFreshness = vi
        .fn()
        .mockReturnValueOnce('valid')
        .mockReturnValueOnce('stale')

      const result = await service.getAvailableLanguagesForArticle('article-1')
      expect(result).toEqual(['en'])
      expect(
        mockTranslationConsistencyService.evaluateTranslationFreshness,
      ).toHaveBeenCalledTimes(2)
    })

    it('should return empty array when article not visible', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: { title: 'T', text: 'X', isPublished: false },
        type: CollectionRefTypes.Post,
      })

      const result = await service.getAvailableLanguagesForArticle('article-1')
      expect(result).toEqual([])
    })

    it('should return empty array when no translations exist', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: { title: 'T', text: 'X' },
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      })

      const result = await service.getAvailableLanguagesForArticle('article-1')
      expect(result).toEqual([])
    })
  })

  describe('getTranslationAndAvailableLanguages', () => {
    it('should return available languages and matching translation in one call', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        meta: { lang: 'zh' },
        modified: new Date('2024-01-01'),
        created: new Date('2024-01-01'),
      }
      const translations = [
        {
          lang: 'en',
          hash: 'h1',
          sourceLang: 'zh',
          sourceModified: new Date('2024-01-02'),
          created: new Date('2024-01-02'),
        },
        {
          lang: 'ja',
          hash: 'h2',
          sourceLang: 'zh',
          sourceModified: new Date('2024-01-02'),
          created: new Date('2024-01-02'),
        },
      ]
      const fullTranslation = { ...mockTranslation, lang: 'en' }

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue(translations),
      })
      mockTranslationModel.findOne.mockResolvedValue(fullTranslation)
      mockTranslationConsistencyService.evaluateTranslationFreshness = vi
        .fn()
        .mockReturnValue('valid')

      const result = await service.getTranslationAndAvailableLanguages(
        'article-1',
        'en',
      )

      expect(result.availableTranslations).toEqual(['en', 'ja'])
      expect(result.translation).toEqual(fullTranslation)
    })

    it('should return null translation when targetLang is not specified', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        modified: new Date('2024-01-01'),
        created: new Date('2024-01-01'),
      }
      const translations = [
        {
          lang: 'en',
          hash: 'h1',
          sourceLang: 'zh',
          sourceModified: new Date('2024-01-02'),
          created: new Date('2024-01-02'),
        },
      ]

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue(translations),
      })
      mockTranslationConsistencyService.evaluateTranslationFreshness = vi
        .fn()
        .mockReturnValue('valid')

      const result =
        await service.getTranslationAndAvailableLanguages('article-1')

      expect(result.availableTranslations).toEqual(['en'])
      expect(result.translation).toBeNull()
      expect(mockTranslationModel.findOne).not.toHaveBeenCalled()
    })

    it('should return null translation when targetLang has no valid match', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        modified: new Date('2024-01-01'),
        created: new Date('2024-01-01'),
      }
      const translations = [
        {
          lang: 'en',
          hash: 'h1',
          sourceLang: 'zh',
          sourceModified: new Date('2024-01-02'),
          created: new Date('2024-01-02'),
        },
      ]

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue(translations),
      })
      mockTranslationConsistencyService.evaluateTranslationFreshness = vi
        .fn()
        .mockReturnValue('valid')

      const result = await service.getTranslationAndAvailableLanguages(
        'article-1',
        'ja',
      )

      expect(result.availableTranslations).toEqual(['en'])
      expect(result.translation).toBeNull()
      expect(mockTranslationModel.findOne).not.toHaveBeenCalled()
    })

    it('should return empty when no translations exist', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: { title: 'T', text: 'X' },
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      })

      const result = await service.getTranslationAndAvailableLanguages(
        'article-1',
        'en',
      )

      expect(result.availableTranslations).toEqual([])
      expect(result.translation).toBeNull()
    })

    it('should throw when article not found', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue(null)

      await expect(
        service.getTranslationAndAvailableLanguages('not-found', 'en'),
      ).rejects.toThrow()
    })

    it('should throw for hidden post when ignoreVisibility is not set', async () => {
      mockDatabaseService.findGlobalById.mockResolvedValue({
        document: { title: 'T', text: 'X', isPublished: false },
        type: CollectionRefTypes.Post,
      })

      await expect(
        service.getTranslationAndAvailableLanguages('article-1', 'en'),
      ).rejects.toThrow()
    })

    it('should allow hidden post when ignoreVisibility is true', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        isPublished: false,
        modified: new Date('2024-01-01'),
        created: new Date('2024-01-01'),
      }

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      })

      const result = await service.getTranslationAndAvailableLanguages(
        'article-1',
        'en',
        { ignoreVisibility: true },
      )

      expect(result.availableTranslations).toEqual([])
      expect(result.translation).toBeNull()
    })

    it('should schedule regeneration when stale translations exist and targetLang is provided', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        modified: new Date('2024-01-01'),
        created: new Date('2024-01-01'),
      }
      const translations = [
        {
          lang: 'en',
          hash: 'h1',
          sourceLang: 'zh',
          sourceModified: new Date('2024-01-02'),
          created: new Date('2024-01-02'),
        },
        {
          lang: 'ja',
          hash: 'h2',
          sourceLang: 'zh',
          sourceModified: new Date('2023-06-01'),
          created: new Date('2023-06-01'),
        },
      ]

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue(translations),
      })
      mockTranslationModel.findOne.mockResolvedValue({
        ...mockTranslation,
        lang: 'en',
      })
      mockTranslationConsistencyService.evaluateTranslationFreshness = vi
        .fn()
        .mockReturnValueOnce('valid')
        .mockReturnValueOnce('stale')

      const scheduleSpy = vi
        .spyOn(service, 'scheduleRegenerationForStaleTranslations')
        .mockResolvedValue(undefined)

      await service.getTranslationAndAvailableLanguages('article-1', 'en')

      expect(scheduleSpy).toHaveBeenCalledWith(['article-1'], 'en')
      scheduleSpy.mockRestore()
    })

    it('should not schedule regeneration when no stale translations', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        modified: new Date('2024-01-01'),
        created: new Date('2024-01-01'),
      }
      const translations = [
        {
          lang: 'en',
          hash: 'h1',
          sourceLang: 'zh',
          sourceModified: new Date('2024-01-02'),
          created: new Date('2024-01-02'),
        },
      ]

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue(translations),
      })
      mockTranslationModel.findOne.mockResolvedValue({
        ...mockTranslation,
        lang: 'en',
      })
      mockTranslationConsistencyService.evaluateTranslationFreshness = vi
        .fn()
        .mockReturnValue('valid')

      const scheduleSpy = vi
        .spyOn(service, 'scheduleRegenerationForStaleTranslations')
        .mockResolvedValue(undefined)

      await service.getTranslationAndAvailableLanguages('article-1', 'en')

      expect(scheduleSpy).not.toHaveBeenCalled()
      scheduleSpy.mockRestore()
    })

    it('should not schedule regeneration when stale but no targetLang', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        modified: new Date('2024-01-01'),
        created: new Date('2024-01-01'),
      }
      const translations = [
        {
          lang: 'en',
          hash: 'h1',
          sourceLang: 'zh',
          sourceModified: new Date('2023-06-01'),
          created: new Date('2023-06-01'),
        },
      ]

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue(translations),
      })
      mockTranslationConsistencyService.evaluateTranslationFreshness = vi
        .fn()
        .mockReturnValue('stale')

      const scheduleSpy = vi
        .spyOn(service, 'scheduleRegenerationForStaleTranslations')
        .mockResolvedValue(undefined)

      await service.getTranslationAndAvailableLanguages('article-1')

      expect(scheduleSpy).not.toHaveBeenCalled()
      scheduleSpy.mockRestore()
    })

    it('should only include valid translations and exclude stale ones', async () => {
      const document = {
        title: 'Test',
        text: 'content',
        modified: new Date('2024-01-01'),
        created: new Date('2024-01-01'),
      }
      const translations = [
        {
          lang: 'en',
          hash: 'h1',
          sourceLang: 'zh',
          sourceModified: new Date('2024-01-02'),
          created: new Date('2024-01-02'),
        },
        {
          lang: 'ja',
          hash: 'h2',
          sourceLang: 'zh',
          sourceModified: new Date('2023-06-01'),
          created: new Date('2023-06-01'),
        },
        {
          lang: 'ko',
          hash: 'h3',
          sourceLang: 'zh',
          sourceModified: new Date('2024-01-02'),
          created: new Date('2024-01-02'),
        },
      ]

      mockDatabaseService.findGlobalById.mockResolvedValue({
        document,
        type: CollectionRefTypes.Post,
      })
      mockTranslationModel.find.mockReturnValue({
        select: vi.fn().mockResolvedValue(translations),
      })
      mockTranslationConsistencyService.evaluateTranslationFreshness = vi
        .fn()
        .mockReturnValueOnce('valid')
        .mockReturnValueOnce('stale')
        .mockReturnValueOnce('valid')

      const result = await service.getTranslationAndAvailableLanguages(
        'article-1',
        'en',
      )

      expect(result.availableTranslations).toEqual(['en', 'ko'])
    })
  })

  // parseModelJson is now in BaseTranslationStrategy and tested via strategy tests
})
