import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TranslationConsistencyService } from '~/modules/ai/ai-translation/translation-consistency.service'
import { TRANSLATION_VALIDATION_DEFAULT_SELECT } from '~/modules/ai/ai-translation/translation-consistency.types'

describe('TranslationConsistencyService', () => {
  let service: TranslationConsistencyService
  let mockDatabaseService: {
    findGlobalByIds: ReturnType<typeof vi.fn>
    flatCollectionToMap: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockDatabaseService = {
      findGlobalByIds: vi.fn(),
      flatCollectionToMap: vi.fn(),
    }
    service = new TranslationConsistencyService(mockDatabaseService as any)
  })

  describe('buildValidationSelect', () => {
    it('should return default select when no custom select is provided', () => {
      expect(service.buildValidationSelect()).toBe(
        TRANSLATION_VALIDATION_DEFAULT_SELECT,
      )
    })

    it('should append required fields to custom select', () => {
      const result = service.buildValidationSelect('refId title')
      expect(result).toContain('refId title')
      expect(result).toContain('hash')
      expect(result).toContain('sourceLang')
      expect(result).toContain('sourceModified')
      expect(result).toContain('created')
    })
  })

  describe('partitionValidAndStaleTranslations', () => {
    it('should mark translation valid when sourceModified is newer', () => {
      const result = service.partitionValidAndStaleTranslations(
        [
          {
            id: 'article-1',
            title: 'Title',
            text: 'Text',
            modified: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        [
          {
            refId: 'article-1',
            hash: 'outdated-hash',
            sourceLang: 'zh',
            sourceModified: new Date('2024-01-02T00:00:00.000Z'),
          } as any,
        ],
      )

      expect(result.validTranslations.has('article-1')).toBe(true)
      expect(result.staleRefIds).toEqual([])
    })

    it('should mark translation valid by created fallback when sourceModified is missing', () => {
      const result = service.partitionValidAndStaleTranslations(
        [
          {
            id: 'article-1',
            title: 'Title',
            text: 'Text',
            created: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        [
          {
            refId: 'article-1',
            hash: 'outdated-hash',
            sourceLang: 'zh',
            created: new Date('2024-01-02T00:00:00.000Z'),
          } as any,
        ],
      )

      expect(result.validTranslations.has('article-1')).toBe(true)
      expect(result.staleRefIds).toEqual([])
    })

    it('should mark translation valid when hash matches', () => {
      const article = {
        id: 'article-1',
        title: 'Title',
        text: 'Text',
        summary: 'Summary',
        tags: ['tag'],
        meta: { lang: 'zh' },
      }
      const hash = service.computeContentHash(
        {
          title: article.title,
          text: article.text,
          summary: article.summary,
          tags: article.tags,
        },
        'zh',
      )

      const result = service.partitionValidAndStaleTranslations(
        [article],
        [
          {
            refId: 'article-1',
            hash,
            sourceLang: 'zh',
          } as any,
        ],
      )

      expect(result.validTranslations.has('article-1')).toBe(true)
      expect(result.staleRefIds).toEqual([])
    })

    it('should mark translation stale when hash does not match', () => {
      const result = service.partitionValidAndStaleTranslations(
        [
          {
            id: 'article-1',
            title: 'Title',
            text: 'Text',
            meta: { lang: 'zh' },
          },
        ],
        [
          {
            refId: 'article-1',
            hash: 'wrong-hash',
            sourceLang: 'zh',
          } as any,
        ],
      )

      expect(result.validTranslations.size).toBe(0)
      expect(result.staleRefIds).toEqual(['article-1'])
    })

    it('should keep status unknown when source is not comparable', () => {
      const result = service.partitionValidAndStaleTranslations(
        [
          {
            id: 'article-1',
            title: 'Title',
          },
        ],
        [
          {
            refId: 'article-1',
            hash: 'wrong-hash',
            sourceLang: 'zh',
          } as any,
        ],
      )

      expect(result.validTranslations.size).toBe(0)
      expect(result.staleRefIds).toEqual([])
    })
  })

  describe('evaluateTranslationFreshness', () => {
    it('should return valid when sourceModified >= article modified', () => {
      const article = {
        id: 'a1',
        title: 'T',
        text: 'X',
        modified: new Date('2024-01-01'),
      }
      const translation = {
        refId: 'a1',
        hash: 'wrong',
        sourceLang: 'zh',
        sourceModified: new Date('2024-01-02'),
        created: new Date('2024-01-02'),
      }

      expect(service.evaluateTranslationFreshness(article, translation)).toBe(
        'valid',
      )
    })

    it('should return valid when sourceModified equals article modified', () => {
      const ts = new Date('2024-06-15')
      const article = { id: 'a1', title: 'T', text: 'X', modified: ts }
      const translation = {
        refId: 'a1',
        hash: 'wrong',
        sourceLang: 'zh',
        sourceModified: ts,
        created: ts,
      }

      expect(service.evaluateTranslationFreshness(article, translation)).toBe(
        'valid',
      )
    })

    it('should fall back to created when sourceModified is missing', () => {
      const article = {
        id: 'a1',
        title: 'T',
        text: 'X',
        created: new Date('2024-01-01'),
      }
      const translation = {
        refId: 'a1',
        hash: 'wrong',
        sourceLang: 'zh',
        sourceModified: undefined as any,
        created: new Date('2024-01-02'),
      }

      expect(service.evaluateTranslationFreshness(article, translation)).toBe(
        'valid',
      )
    })

    it('should return unknown when source has no comparable text/content', () => {
      const article = { id: 'a1', title: 'T' }
      const translation = {
        refId: 'a1',
        hash: 'some-hash',
        sourceLang: 'zh',
        sourceModified: undefined as any,
        created: undefined as any,
      }

      expect(service.evaluateTranslationFreshness(article, translation)).toBe(
        'unknown',
      )
    })

    it('should return valid when hash matches', () => {
      const article = {
        id: 'a1',
        title: 'Title',
        text: 'Text',
        meta: { lang: 'zh' },
      }
      const hash = service.computeContentHash(
        { title: article.title, text: article.text },
        'zh',
      )
      const translation = {
        refId: 'a1',
        hash,
        sourceLang: 'zh',
        sourceModified: undefined as any,
        created: undefined as any,
      }

      expect(service.evaluateTranslationFreshness(article, translation)).toBe(
        'valid',
      )
    })

    it('should return stale when hash does not match and timestamps cannot confirm', () => {
      const article = {
        id: 'a1',
        title: 'Title',
        text: 'Text',
        meta: { lang: 'zh' },
      }
      const translation = {
        refId: 'a1',
        hash: 'outdated-hash',
        sourceLang: 'zh',
        sourceModified: undefined as any,
        created: undefined as any,
      }

      expect(service.evaluateTranslationFreshness(article, translation)).toBe(
        'stale',
      )
    })

    it('should use article.created when article.modified is null', () => {
      const article = {
        id: 'a1',
        title: 'T',
        text: 'X',
        modified: null,
        created: new Date('2024-03-01'),
      }
      const translation = {
        refId: 'a1',
        hash: 'wrong',
        sourceLang: 'zh',
        sourceModified: new Date('2024-03-02'),
        created: new Date('2024-03-02'),
      }

      expect(service.evaluateTranslationFreshness(article, translation)).toBe(
        'valid',
      )
    })
  })

  describe('filterTrulyStaleTranslations', () => {
    it('should return only truly stale ref ids after db re-check', async () => {
      const article1 = {
        title: 'Title 1',
        text: 'Text 1',
        meta: { lang: 'zh' },
      }
      const article2 = {
        title: 'Title 2',
        text: 'Text 2',
        meta: { lang: 'zh' },
      }
      const hash1 = service.computeContentHash(
        { title: article1.title, text: article1.text },
        'zh',
      )

      mockDatabaseService.findGlobalByIds.mockResolvedValue({
        posts: [],
        notes: [],
        pages: [],
        recentlies: [],
      })
      mockDatabaseService.flatCollectionToMap.mockReturnValue({
        'article-1': article1,
        'article-2': article2,
      })

      const result = await service.filterTrulyStaleTranslations([
        { refId: 'article-1', hash: hash1, sourceLang: 'zh' } as any,
        { refId: 'article-2', hash: 'stale-hash', sourceLang: 'zh' } as any,
      ])

      expect(mockDatabaseService.findGlobalByIds).toHaveBeenCalledWith([
        'article-1',
        'article-2',
      ])
      expect(result).toEqual(['article-2'])
    })

    it('should ignore non-translatable documents', async () => {
      mockDatabaseService.findGlobalByIds.mockResolvedValue({
        posts: [],
        notes: [],
        pages: [],
        recentlies: [],
      })
      mockDatabaseService.flatCollectionToMap.mockReturnValue({
        'article-1': { foo: 'bar' },
      })

      const result = await service.filterTrulyStaleTranslations([
        { refId: 'article-1', hash: 'stale-hash', sourceLang: 'zh' } as any,
      ])

      expect(result).toEqual([])
    })
  })
})
