import { Test } from '@nestjs/testing'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { TranslationService } from '~/processors/helper/helper.translation.service'
import type { ArticleTranslationInput } from '~/processors/helper/helper.translation.service'

const createMockAiTranslationService = () => ({
  getAvailableLanguagesForArticle: vi.fn(),
  getTranslationForArticle: vi.fn(),
  getValidTranslationsForArticles: vi.fn(),
})

describe('TranslationService', () => {
  let service: TranslationService
  let mockAiTranslationService: ReturnType<
    typeof createMockAiTranslationService
  >

  beforeEach(async () => {
    mockAiTranslationService = createMockAiTranslationService()

    const moduleRef = await Test.createTestingModule({
      providers: [
        TranslationService,
        {
          provide: AiTranslationService,
          useValue: mockAiTranslationService,
        },
      ],
    }).compile()

    service = moduleRef.get(TranslationService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('translateArticle', () => {
    const originalData = {
      title: 'Test Title',
      text: 'Test Content',
      summary: 'Test Summary',
      tags: ['tag1', 'tag2'],
    }

    it('should return original data when targetLang is undefined', async () => {
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        ['en', 'ja'],
      )

      const result = await service.translateArticle({
        articleId: 'article-1',
        targetLang: undefined,
        originalData,
      })

      expect(result).toEqual({
        ...originalData,
        isTranslated: false,
        availableTranslations: ['en', 'ja'],
      })
    })

    it('should return original data when targetLang is empty string', async () => {
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        [],
      )

      const result = await service.translateArticle({
        articleId: 'article-1',
        targetLang: '',
        originalData,
      })

      expect(result.isTranslated).toBe(false)
      expect(result.title).toBe(originalData.title)
    })

    it('should return original data when no translation found', async () => {
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        ['ja'],
      )
      mockAiTranslationService.getTranslationForArticle.mockResolvedValue(null)

      const result = await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'en',
        originalData,
      })

      expect(result).toEqual({
        ...originalData,
        isTranslated: false,
        availableTranslations: ['ja'],
      })
    })

    it('should return translated data when translation exists', async () => {
      const translatedAt = new Date()
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        ['en', 'ja'],
      )
      mockAiTranslationService.getTranslationForArticle.mockResolvedValue({
        title: 'Translated Title',
        text: 'Translated Content',
        summary: 'Translated Summary',
        tags: ['translated-tag'],
        sourceLang: 'zh',
        lang: 'en',
        created: translatedAt,
        aiModel: 'gpt-4',
      })

      const result = await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'en',
        originalData,
      })

      expect(result).toEqual({
        title: 'Translated Title',
        text: 'Translated Content',
        summary: 'Translated Summary',
        tags: ['translated-tag'],
        isTranslated: true,
        translationMeta: {
          sourceLang: 'zh',
          targetLang: 'en',
          translatedAt,
          model: 'gpt-4',
        },
        availableTranslations: ['en', 'ja'],
      })
    })

    it('should use original summary when translation has no summary', async () => {
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        [],
      )
      mockAiTranslationService.getTranslationForArticle.mockResolvedValue({
        title: 'Translated Title',
        text: 'Translated Content',
        summary: null,
        tags: null,
        sourceLang: 'zh',
        lang: 'en',
        created: new Date(),
        aiModel: 'gpt-4',
      })

      const result = await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'en',
        originalData,
      })

      expect(result.summary).toBe(originalData.summary)
      expect(result.tags).toEqual(originalData.tags)
    })

    it('should pass allowHidden option correctly', async () => {
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        [],
      )
      mockAiTranslationService.getTranslationForArticle.mockResolvedValue(null)

      await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'en',
        allowHidden: true,
        originalData,
      })

      expect(
        mockAiTranslationService.getTranslationForArticle,
      ).toHaveBeenCalledWith('article-1', 'en', { ignoreVisibility: true })
    })

    it('should return original data when translation service throws error', async () => {
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        ['en'],
      )
      mockAiTranslationService.getTranslationForArticle.mockRejectedValue(
        new Error('Service error'),
      )

      const result = await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'en',
        originalData,
      })

      expect(result).toEqual({
        ...originalData,
        isTranslated: false,
        availableTranslations: ['en'],
      })
    })

    it('should normalize language code correctly', async () => {
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        [],
      )
      mockAiTranslationService.getTranslationForArticle.mockResolvedValue(null)

      await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'zh-CN',
        originalData,
      })

      expect(
        mockAiTranslationService.getTranslationForArticle,
      ).toHaveBeenCalledWith('article-1', 'zh', undefined)
    })
  })

  describe('translateList', () => {
    interface TestItem {
      id: string
      title: string
      text: string
      translatedTitle?: string
    }

    const items: TestItem[] = [
      { id: '1', title: 'Title 1', text: 'Text 1' },
      { id: '2', title: 'Title 2', text: 'Text 2' },
    ]

    const getInput = (item: TestItem): ArticleTranslationInput => ({
      id: item.id,
      title: item.title,
      text: item.text,
    })

    const applyResult = (
      item: TestItem,
      result: { isTranslated: boolean; title?: string } | undefined,
    ): TestItem => {
      if (result?.isTranslated && result.title) {
        return { ...item, translatedTitle: result.title }
      }
      return item
    }

    it('should return items with undefined result when no targetLang', async () => {
      const result = await service.translateList({
        items,
        targetLang: undefined,
        getInput,
        applyResult,
      })

      expect(result).toEqual(items)
    })

    it('should return items with undefined result when targetLang is empty', async () => {
      const result = await service.translateList({
        items,
        targetLang: '',
        getInput,
        applyResult,
      })

      expect(result).toEqual(items)
    })

    it('should return items with undefined result when items array is empty', async () => {
      const result = await service.translateList({
        items: [],
        targetLang: 'en',
        getInput,
        applyResult,
      })

      expect(result).toEqual([])
    })

    it('should translate items and apply results', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        new Map([
          [
            '1',
            {
              title: 'Translated Title 1',
              text: 'Translated Text 1',
              sourceLang: 'zh',
              lang: 'en',
              created: new Date(),
            },
          ],
        ]),
      )

      const result = await service.translateList({
        items,
        targetLang: 'en',
        translationFields: ['title'] as const,
        getInput,
        applyResult,
      })

      expect(result[0].translatedTitle).toBe('Translated Title 1')
      expect(result[1].translatedTitle).toBeUndefined()
    })
  })

  describe('translateArticleList', () => {
    const articles: ArticleTranslationInput[] = [
      {
        id: '1',
        title: 'Title 1',
        text: 'Text 1',
        summary: 'Summary 1',
        tags: ['a'],
      },
      { id: '2', title: 'Title 2', text: 'Text 2', summary: null },
    ]

    it('should return untranslated results when no targetLang', async () => {
      const result = await service.translateArticleList({
        articles,
        targetLang: undefined,
      })

      expect(result.size).toBe(2)
      expect(result.get('1')?.isTranslated).toBe(false)
      expect(result.get('1')?.title).toBe('Title 1')
      expect(result.get('2')?.isTranslated).toBe(false)
    })

    it('should return untranslated results when articles array is empty', async () => {
      const result = await service.translateArticleList({
        articles: [],
        targetLang: 'en',
      })

      expect(result.size).toBe(0)
    })

    it('should return translated results when translations exist', async () => {
      const createdDate = new Date()
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        new Map([
          [
            '1',
            {
              title: 'Translated Title 1',
              text: 'Translated Text 1',
              summary: 'Translated Summary 1',
              tags: ['translated-a'],
              sourceLang: 'zh',
              lang: 'en',
              created: createdDate,
              aiModel: 'gpt-4',
            },
          ],
        ]),
      )

      const result = await service.translateArticleList({
        articles,
        targetLang: 'en',
      })

      expect(result.size).toBe(2)

      const translated = result.get('1')!
      expect(translated.isTranslated).toBe(true)
      expect(translated.title).toBe('Translated Title 1')
      expect(translated.text).toBe('Translated Text 1')
      expect(translated.summary).toBe('Translated Summary 1')
      expect(translated.tags).toEqual(['translated-a'])
      expect(translated.translationMeta).toEqual({
        sourceLang: 'zh',
        targetLang: 'en',
        translatedAt: createdDate,
        model: 'gpt-4',
      })

      const untranslated = result.get('2')!
      expect(untranslated.isTranslated).toBe(false)
      expect(untranslated.title).toBe('Title 2')
    })

    it('should use original values when translation has null fields', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        new Map([
          [
            '1',
            {
              title: 'Translated Title 1',
              text: 'Translated Text 1',
              summary: null,
              tags: null,
              sourceLang: 'zh',
              lang: 'en',
              created: new Date(),
            },
          ],
        ]),
      )

      const result = await service.translateArticleList({
        articles,
        targetLang: 'en',
      })

      const translated = result.get('1')!
      expect(translated.summary).toBe('Summary 1')
      expect(translated.tags).toEqual(['a'])
    })

    it('should return original data when service throws error', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockRejectedValue(
        new Error('Service error'),
      )

      const result = await service.translateArticleList({
        articles,
        targetLang: 'en',
      })

      expect(result.size).toBe(2)
      expect(result.get('1')?.isTranslated).toBe(false)
      expect(result.get('1')?.title).toBe('Title 1')
    })

    it('should handle custom translationFields', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        new Map([
          [
            '1',
            {
              title: 'Translated Title 1',
              text: 'Translated Text 1',
              sourceLang: 'zh',
              lang: 'en',
              created: new Date(),
            },
          ],
        ]),
      )

      const result = await service.translateArticleList({
        articles,
        targetLang: 'en',
        translationFields: ['title'] as const,
      })

      const translated = result.get('1')!
      expect(translated.isTranslated).toBe(true)
      expect(translated.title).toBe('Translated Title 1')
      expect((translated as any).text).toBeUndefined()
    })

    it('should exclude translationMeta when not in fields', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        new Map([
          [
            '1',
            {
              title: 'Translated Title 1',
              text: 'Translated Text 1',
              sourceLang: 'zh',
              lang: 'en',
              created: new Date(),
              aiModel: 'gpt-4',
            },
          ],
        ]),
      )

      const result = await service.translateArticleList({
        articles,
        targetLang: 'en',
        translationFields: ['title', 'text'] as const,
      })

      const translated = result.get('1')!
      expect(translated.isTranslated).toBe(true)
      expect((translated as any).translationMeta).toBeUndefined()
    })

    it('should build correct select string', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        new Map(),
      )

      await service.translateArticleList({
        articles,
        targetLang: 'en',
        translationFields: ['title', 'summary', 'translationMeta'] as const,
      })

      expect(
        mockAiTranslationService.getValidTranslationsForArticles,
      ).toHaveBeenCalledWith(
        articles,
        'en',
        expect.objectContaining({
          select: expect.stringContaining('title'),
        }),
      )
    })

    it('should normalize various language code formats', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        new Map(),
      )

      await service.translateArticleList({
        articles,
        targetLang: 'en-US',
      })

      expect(
        mockAiTranslationService.getValidTranslationsForArticles,
      ).toHaveBeenCalledWith(articles, 'en', expect.any(Object))
    })

    it('should handle articles with empty text', async () => {
      const articlesWithEmptyText: ArticleTranslationInput[] = [
        { id: '1', title: 'Title 1' },
      ]

      const result = await service.translateArticleList({
        articles: articlesWithEmptyText,
        targetLang: undefined,
      })

      expect(result.get('1')?.text).toBe('')
    })
  })

  describe('edge cases', () => {
    it('should handle special language codes', async () => {
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        [],
      )
      mockAiTranslationService.getTranslationForArticle.mockResolvedValue(null)

      const originalData = { title: 'Test', text: 'Text' }

      // Test various language code formats
      const testCases = [
        { input: 'jp', expected: 'ja' },
        { input: 'cn', expected: 'zh' },
        { input: 'zh-tw', expected: 'zh' },
        { input: 'en-gb', expected: 'en' },
        { input: 'pt-br', expected: 'pt' },
      ]

      for (const testCase of testCases) {
        await service.translateArticle({
          articleId: 'article-1',
          targetLang: testCase.input,
          originalData,
        })

        expect(
          mockAiTranslationService.getTranslationForArticle,
        ).toHaveBeenCalledWith('article-1', testCase.expected, undefined)
      }
    })

    it('should handle null summary in original data', async () => {
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        [],
      )
      mockAiTranslationService.getTranslationForArticle.mockResolvedValue({
        title: 'Translated',
        text: 'Translated Text',
        summary: null,
        tags: null,
        sourceLang: 'zh',
        lang: 'en',
        created: new Date(),
      })

      const result = await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'en',
        originalData: {
          title: 'Test',
          text: 'Text',
          summary: null,
        },
      })

      expect(result.summary).toBeNull()
    })

    it('should handle undefined tags in original data', async () => {
      mockAiTranslationService.getAvailableLanguagesForArticle.mockResolvedValue(
        [],
      )
      mockAiTranslationService.getTranslationForArticle.mockResolvedValue({
        title: 'Translated',
        text: 'Translated Text',
        summary: null,
        tags: null,
        sourceLang: 'zh',
        lang: 'en',
        created: new Date(),
      })

      const result = await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'en',
        originalData: {
          title: 'Test',
          text: 'Text',
        },
      })

      expect(result.tags).toBeUndefined()
    })
  })

  describe('buildTranslationSelect (private method via translateArticleList)', () => {
    it('should include all fields for default fields', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        new Map(),
      )

      await service.translateArticleList({
        articles: [{ id: '1', title: 'T', text: 'X' }],
        targetLang: 'en',
      })

      const call =
        mockAiTranslationService.getValidTranslationsForArticles.mock.calls[0]
      const selectString = call[2]?.select as string

      expect(selectString).toContain('refId')
      expect(selectString).toContain('hash')
      expect(selectString).toContain('sourceLang')
      expect(selectString).toContain('sourceModified')
      expect(selectString).toContain('title')
      expect(selectString).toContain('text')
      expect(selectString).toContain('summary')
      expect(selectString).toContain('tags')
      expect(selectString).toContain('lang')
      expect(selectString).toContain('created')
      expect(selectString).toContain('aiModel')
    })

    it('should include only specified fields', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        new Map(),
      )

      await service.translateArticleList({
        articles: [{ id: '1', title: 'T', text: 'X' }],
        targetLang: 'en',
        translationFields: ['title'] as const,
      })

      const call =
        mockAiTranslationService.getValidTranslationsForArticles.mock.calls[0]
      const selectString = call[2]?.select as string

      expect(selectString).toContain('title')
      expect(selectString).toContain('refId')
      expect(selectString).not.toContain(' text ')
      expect(selectString).not.toContain('summary')
    })
  })

  describe('pickTranslationFields (private method via translateArticleList)', () => {
    it('should pick specified fields correctly', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        new Map([
          [
            '1',
            {
              title: 'Translated',
              text: 'Text',
              summary: 'Summary',
              tags: ['tag'],
              sourceLang: 'zh',
              lang: 'en',
              created: new Date(),
              aiModel: 'gpt-4',
            },
          ],
        ]),
      )

      const result = await service.translateArticleList({
        articles: [{ id: '1', title: 'T', text: 'X' }],
        targetLang: 'en',
        translationFields: ['title', 'summary'] as const,
      })

      const translated = result.get('1')!
      expect(translated.isTranslated).toBe(true)
      expect(translated.title).toBe('Translated')
      expect(translated.summary).toBe('Summary')
      expect((translated as any).text).toBeUndefined()
      expect((translated as any).tags).toBeUndefined()
    })

    it('should always include isTranslated', async () => {
      const result = await service.translateArticleList({
        articles: [{ id: '1', title: 'T', text: 'X' }],
        targetLang: undefined,
        translationFields: ['title'] as const,
      })

      const item = result.get('1')!
      expect(item.isTranslated).toBe(false)
      expect(item.title).toBe('T')
    })
  })
})
