import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RedisKeys } from '~/constants/cache.constant'
import { AiService } from '~/modules/ai/ai.service'
import { TranslationEntryModel } from '~/modules/ai/ai-translation/translation-entry.model'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { CategoryModel } from '~/modules/category/category.model'
import { ConfigsService } from '~/modules/configs/configs.service'
import { NoteModel } from '~/modules/note/note.model'
import { TopicModel } from '~/modules/topic/topic.model'
import { RedisService } from '~/processors/redis/redis.service'
import { getModelToken } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils/redis.util'

const createFindQueryMock = (value: any[] = []) => ({
  lean: vi.fn().mockResolvedValue(value),
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  select: vi.fn().mockImplementation(() => ({
    lean: vi.fn().mockResolvedValue(value),
  })),
})

describe('TranslationEntryService', () => {
  let service: TranslationEntryService
  let mockEntryModel: any
  let mockCategoryModel: any
  let mockNoteModel: any
  let mockTopicModel: any
  let mockAiService: any
  let mockConfigService: any
  let mockRedisService: any
  let mockRedisClient: any
  let mockRedisPipeline: any

  beforeEach(async () => {
    mockEntryModel = {
      find: vi.fn().mockReturnValue(createFindQueryMock([])),
      findByIdAndUpdate: vi.fn(),
      findByIdAndDelete: vi.fn(),
      updateOne: vi.fn(),
      deleteMany: vi.fn(),
      countDocuments: vi.fn().mockResolvedValue(0),
    }

    mockCategoryModel = {
      find: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    }

    mockNoteModel = {
      distinct: vi.fn().mockResolvedValue([]),
    }

    mockTopicModel = {
      find: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    }

    mockAiService = {
      getTranslationModel: vi.fn().mockResolvedValue({
        generateStructured: vi.fn().mockResolvedValue({
          output: { translations: {} },
        }),
      }),
    }

    mockConfigService = {
      get: vi.fn().mockResolvedValue({
        translationTargetLanguages: ['en', 'ja'],
      }),
    }

    mockRedisPipeline = {
      hset: vi.fn().mockReturnThis(),
      hdel: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }

    mockRedisClient = {
      hmget: vi.fn().mockResolvedValue([]),
      pipeline: vi.fn().mockReturnValue(mockRedisPipeline),
    }

    mockRedisService = {
      getClient: vi.fn().mockReturnValue(mockRedisClient),
    }

    const module = await Test.createTestingModule({
      providers: [
        TranslationEntryService,
        {
          provide: getModelToken(TranslationEntryModel.name),
          useValue: mockEntryModel,
        },
        {
          provide: getModelToken(CategoryModel.name),
          useValue: mockCategoryModel,
        },
        { provide: getModelToken(NoteModel.name), useValue: mockNoteModel },
        { provide: getModelToken(TopicModel.name), useValue: mockTopicModel },
        { provide: AiService, useValue: mockAiService },
        { provide: ConfigsService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile()

    service = module.get(TranslationEntryService)
  })

  describe('hashSourceText', () => {
    it('should produce consistent hash for same text', () => {
      const h1 = TranslationEntryService.hashSourceText('前端开发')
      const h2 = TranslationEntryService.hashSourceText('前端开发')
      expect(h1).toBe(h2)
    })

    it('should normalize whitespace and case', () => {
      const h1 = TranslationEntryService.hashSourceText(' Hello ')
      const h2 = TranslationEntryService.hashSourceText('hello')
      expect(h1).toBe(h2)
    })

    it('should differ for different text', () => {
      const h1 = TranslationEntryService.hashSourceText('foo')
      const h2 = TranslationEntryService.hashSourceText('bar')
      expect(h1).not.toBe(h2)
    })
  })

  describe('getTranslations', () => {
    it('should return empty map when no lookupKeys', async () => {
      const result = await service.getTranslations('category.name', 'en', [])
      expect(result.size).toBe(0)
      expect(mockEntryModel.find).not.toHaveBeenCalled()
    })

    it('should query and return map', async () => {
      mockEntryModel.find.mockReturnValue(
        createFindQueryMock([
          {
            keyPath: 'category.name',
            keyType: 'entity',
            lookupKey: 'id-1',
            translatedText: 'Frontend',
          },
          {
            keyPath: 'category.name',
            keyType: 'entity',
            lookupKey: 'id-2',
            translatedText: 'Backend',
          },
        ]),
      )

      const result = await service.getTranslations('category.name', 'en', [
        'id-1',
        'id-2',
      ])
      expect(result.get('id-1')).toBe('Frontend')
      expect(result.get('id-2')).toBe('Backend')
      expect(mockEntryModel.find).toHaveBeenCalledTimes(1)
    })
  })

  describe('getTranslationsForDict', () => {
    it('should return empty map for empty inputs', async () => {
      const result = await service.getTranslationsForDict('note.mood', 'en', [])
      expect(result.size).toBe(0)
    })

    it('should deduplicate and map by sourceText', async () => {
      const hash = TranslationEntryService.hashSourceText('开心')
      mockEntryModel.find.mockReturnValue(
        createFindQueryMock([
          {
            keyPath: 'note.mood',
            keyType: 'dict',
            lookupKey: hash,
            translatedText: 'Happy',
          },
        ]),
      )

      const result = await service.getTranslationsForDict('note.mood', 'en', [
        '开心',
        '开心',
      ])
      expect(result.size).toBe(1)
      expect(result.get('开心')).toBe('Happy')
    })
  })

  describe('getTranslationsBatch', () => {
    it('should merge db lookups and hydrate dict cache', async () => {
      const rainHash = TranslationEntryService.hashSourceText('雨天')
      const sunnyHash = TranslationEntryService.hashSourceText('晴天')

      mockRedisClient.hmget.mockResolvedValueOnce([null, 'Sunny'])
      mockEntryModel.find.mockReturnValue(
        createFindQueryMock([
          {
            keyPath: 'category.name',
            keyType: 'entity',
            lookupKey: 'id-1',
            translatedText: 'Frontend',
          },
          {
            keyPath: 'note.weather',
            keyType: 'dict',
            lookupKey: rainHash,
            translatedText: 'Rainy',
          },
        ]),
      )

      const result = await service.getTranslationsBatch('en', {
        entityLookups: [{ keyPath: 'category.name', lookupKeys: ['id-1'] }],
        dictLookups: [
          { keyPath: 'note.weather', sourceTexts: ['雨天', '晴天'] },
        ],
      })

      expect(mockEntryModel.find).toHaveBeenCalledTimes(1)
      expect(mockEntryModel.find).toHaveBeenCalledWith({
        lang: 'en',
        $or: [
          {
            keyPath: 'category.name',
            keyType: 'entity',
            lookupKey: { $in: ['id-1'] },
          },
          {
            keyPath: 'note.weather',
            keyType: 'dict',
            lookupKey: { $in: [rainHash] },
          },
        ],
      })
      expect(mockRedisClient.hmget).toHaveBeenCalledWith(
        getRedisKey(RedisKeys.TranslationEntryDict, 'en', 'note.weather'),
        rainHash,
        sunnyHash,
      )
      expect(result.entityMaps.get('category.name')?.get('id-1')).toBe(
        'Frontend',
      )
      expect(result.dictMaps.get('note.weather')?.get('晴天')).toBe('Sunny')
      expect(result.dictMaps.get('note.weather')?.get('雨天')).toBe('Rainy')
      expect(mockRedisPipeline.hset).toHaveBeenCalledWith(
        getRedisKey(RedisKeys.TranslationEntryDict, 'en', 'note.weather'),
        rainHash,
        'Rainy',
      )
      expect(mockRedisPipeline.expire).toHaveBeenCalledWith(
        getRedisKey(RedisKeys.TranslationEntryDict, 'en', 'note.weather'),
        60 * 60 * 24 * 7,
      )
    })
  })

  describe('collectSourceValues', () => {
    it('should collect from categories, topics, notes', async () => {
      mockCategoryModel.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([{ id: 'cat-1', name: '前端' }]),
        }),
      })

      mockTopicModel.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi
            .fn()
            .mockResolvedValue([
              { id: 'topic-1', name: '日记', introduce: '每日记录' },
            ]),
        }),
      })

      mockNoteModel.distinct
        .mockResolvedValueOnce(['开心'])
        .mockResolvedValueOnce(['晴天'])

      const values = await service.collectSourceValues()
      expect(values).toHaveLength(5)
      expect(values[0]).toMatchObject({
        keyPath: 'category.name',
        keyType: 'entity',
        lookupKey: 'cat-1',
        sourceText: '前端',
      })
      expect(values[1]).toMatchObject({
        keyPath: 'topic.name',
        sourceText: '日记',
      })
      expect(values[2]).toMatchObject({
        keyPath: 'topic.introduce',
        sourceText: '每日记录',
      })
      expect(values[3]).toMatchObject({ keyPath: 'note.mood', keyType: 'dict' })
      expect(values[4]).toMatchObject({
        keyPath: 'note.weather',
        keyType: 'dict',
      })
    })

    it('should skip falsy values', async () => {
      mockCategoryModel.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([{ id: 'cat-1', name: '' }]),
        }),
      })
      mockTopicModel.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      })
      mockNoteModel.distinct.mockResolvedValue([null, undefined, ''])

      const values = await service.collectSourceValues()
      expect(values).toHaveLength(0)
    })
  })

  describe('handleEntityUpdate', () => {
    it('should delete all entries when newSourceText is empty', async () => {
      await service.handleEntityUpdate('category.name', 'cat-1', '')
      expect(mockEntryModel.deleteMany).toHaveBeenCalledWith({
        keyPath: 'category.name',
        lookupKey: 'cat-1',
      })
    })

    it('should delete stale entries when source text changed', async () => {
      mockEntryModel.find.mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { lookupKey: 'cat-1', lang: 'en', sourceText: '旧名称' },
          { lookupKey: 'cat-1', lang: 'ja', sourceText: '新名称' },
        ]),
      })

      await service.handleEntityUpdate('category.name', 'cat-1', '新名称')
      expect(mockEntryModel.deleteMany).toHaveBeenCalledWith({
        keyPath: 'category.name',
        lookupKey: 'cat-1',
        lang: { $in: ['en'] },
      })
    })

    it('should do nothing when no existing entries', async () => {
      mockEntryModel.find.mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      })

      await service.handleEntityUpdate('category.name', 'cat-1', '前端')
      expect(mockEntryModel.deleteMany).not.toHaveBeenCalled()
    })
  })

  describe('generateTranslations', () => {
    it('should return early when no target languages', async () => {
      mockConfigService.get.mockResolvedValue({
        translationTargetLanguages: [],
      })
      const result = await service.generateTranslations({})
      expect(result).toEqual({ created: 0, skipped: 0 })
    })

    it('should return early when no source values', async () => {
      const result = await service.generateTranslations({})
      expect(result.created).toBe(0)
    })
  })
})
