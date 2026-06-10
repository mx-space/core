import { Test } from '@nestjs/testing'

import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import type {
  ArticleTranslationInput,
  EntryMaps,
  TranslationResult,
} from '~/processors/helper/helper.translation.service'
import {
  applyArticleTranslationInPlace,
  applyTranslationEntriesInPlace,
  buildArticleTranslationMeta,
  TranslationService,
} from '~/processors/helper/helper.translation.service'

const createMockAiTranslationService = () => ({
  getAvailableLanguagesForArticle: vi.fn(),
  getTranslationForArticle: vi.fn(),
  getTranslationAndAvailableLanguages: vi.fn(),
  getValidTranslationsForArticles: vi.fn(),
})

const createTranslationLookup = (
  entries: Array<[string, any]> = [],
  staleRefIds: string[] = [],
) => ({
  validTranslations: new Map(entries),
  staleRefIds,
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
        {
          provide: TranslationEntryService,
          useValue: {
            getTranslations: vi.fn().mockResolvedValue(new Map()),
            getTranslationsForDict: vi.fn().mockResolvedValue(new Map()),
          },
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
      subtitle: 'Test Subtitle',
      summary: 'Test Summary',
      tags: ['tag1', 'tag2'],
    }

    it('should return original data when targetLang is undefined', async () => {
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockResolvedValue(
        { availableTranslations: ['en', 'ja'], translation: null },
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
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockResolvedValue(
        { availableTranslations: [], translation: null },
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
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockResolvedValue(
        { availableTranslations: ['ja'], translation: null },
      )

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
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockResolvedValue(
        {
          availableTranslations: ['en', 'ja'],
          translation: {
            title: 'Translated Title',
            text: 'Translated Content',
            subtitle: 'Translated Subtitle',
            summary: 'Translated Summary',
            tags: ['translated-tag'],
            sourceLang: 'zh',
            lang: 'en',
            createdAt: translatedAt,
            aiModel: 'gpt-4',
          },
        },
      )

      const result = await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'en',
        originalData,
      })

      expect(result).toEqual({
        title: 'Translated Title',
        text: 'Translated Content',
        subtitle: 'Translated Subtitle',
        summary: 'Translated Summary',
        tags: ['translated-tag'],
        isTranslated: true,
        sourceLang: 'zh',
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
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockResolvedValue(
        {
          availableTranslations: [],
          translation: {
            title: 'Translated Title',
            text: 'Translated Content',
            subtitle: null,
            summary: null,
            tags: null,
            sourceLang: 'zh',
            lang: 'en',
            createdAt: new Date(),
            aiModel: 'gpt-4',
          },
        },
      )

      const result = await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'en',
        originalData,
      })

      expect(result.summary).toBe(originalData.summary)
      expect(result.tags).toEqual(originalData.tags)
      expect((result as any).subtitle).toBe(originalData.subtitle)
    })

    it('should pass allowHidden option correctly', async () => {
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockResolvedValue(
        { availableTranslations: [], translation: null },
      )

      await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'en',
        allowHidden: true,
        originalData,
      })

      expect(
        mockAiTranslationService.getTranslationAndAvailableLanguages,
      ).toHaveBeenCalledWith('article-1', 'en', { ignoreVisibility: true })
    })

    it('should return original data when translation service throws error', async () => {
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockRejectedValue(
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
      })
    })

    it('should normalize language code correctly', async () => {
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockResolvedValue(
        { availableTranslations: [], translation: null },
      )

      await service.translateArticle({
        articleId: 'article-1',
        targetLang: 'zh-CN',
        originalData,
      })

      expect(
        mockAiTranslationService.getTranslationAndAvailableLanguages,
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
        createTranslationLookup([
          [
            '1',
            {
              title: 'Translated Title 1',
              text: 'Translated Text 1',
              sourceLang: 'zh',
              lang: 'en',
              createdAt: new Date(),
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
        subtitle: 'Subtitle 1',
        summary: 'Summary 1',
        tags: ['a'],
      } as ArticleTranslationInput,
      {
        id: '2',
        title: 'Title 2',
        text: 'Text 2',
        subtitle: 'Subtitle 2',
        summary: null,
      } as ArticleTranslationInput,
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
        createTranslationLookup([
          [
            '1',
            {
              title: 'Translated Title 1',
              text: 'Translated Text 1',
              subtitle: 'Translated Subtitle 1',
              summary: 'Translated Summary 1',
              tags: ['translated-a'],
              sourceLang: 'zh',
              lang: 'en',
              createdAt: createdDate,
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
      expect((translated as any).subtitle).toBe('Translated Subtitle 1')
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
        createTranslationLookup([
          [
            '1',
            {
              title: 'Translated Title 1',
              text: 'Translated Text 1',
              subtitle: null,
              summary: null,
              tags: null,
              sourceLang: 'zh',
              lang: 'en',
              createdAt: new Date(),
            },
          ],
        ]),
      )

      const result = await service.translateArticleList({
        articles,
        targetLang: 'en',
      })

      const translated = result.get('1')!
      expect((translated as any).subtitle).toBe('Subtitle 1')
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
        createTranslationLookup([
          [
            '1',
            {
              title: 'Translated Title 1',
              text: 'Translated Text 1',
              sourceLang: 'zh',
              lang: 'en',
              createdAt: new Date(),
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
        createTranslationLookup([
          [
            '1',
            {
              title: 'Translated Title 1',
              text: 'Translated Text 1',
              sourceLang: 'zh',
              lang: 'en',
              createdAt: new Date(),
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

    it('should normalize various language code formats', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        createTranslationLookup(),
      )

      await service.translateArticleList({
        articles,
        targetLang: 'en-US',
      })

      expect(
        mockAiTranslationService.getValidTranslationsForArticles,
      ).toHaveBeenCalledWith(articles, 'en')
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
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockResolvedValue(
        { availableTranslations: [], translation: null },
      )

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
          mockAiTranslationService.getTranslationAndAvailableLanguages,
        ).toHaveBeenCalledWith('article-1', testCase.expected, undefined)
      }
    })

    it('should handle null summary in original data', async () => {
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockResolvedValue(
        {
          availableTranslations: [],
          translation: {
            title: 'Translated',
            text: 'Translated Text',
            summary: null,
            tags: null,
            sourceLang: 'zh',
            lang: 'en',
            createdAt: new Date(),
          },
        },
      )

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
      mockAiTranslationService.getTranslationAndAvailableLanguages.mockResolvedValue(
        {
          availableTranslations: [],
          translation: {
            title: 'Translated',
            text: 'Translated Text',
            summary: null,
            tags: null,
            sourceLang: 'zh',
            lang: 'en',
            createdAt: new Date(),
          },
        },
      )

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

  describe('pickTranslationFields (private method via translateArticleList)', () => {
    it('should pick specified fields correctly', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        createTranslationLookup([
          [
            '1',
            {
              title: 'Translated',
              text: 'Text',
              summary: 'Summary',
              tags: ['tag'],
              sourceLang: 'zh',
              lang: 'en',
              createdAt: new Date(),
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

  describe('collectArticleTranslations', () => {
    const articles: ArticleTranslationInput[] = [
      { id: 'a1', title: 'Title 1', text: 'Text 1' },
      { id: 'a2', title: 'Title 2', text: 'Text 2' },
    ]

    it('returns slim meta — no title/text/content in meta map', async () => {
      const translatedAt = new Date()
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        {
          validTranslations: new Map([
            [
              'a1',
              {
                title: 'T1',
                text: 'X1',
                content: 'C1',
                contentFormat: 'markdown',
                sourceLang: 'zh',
                lang: 'en',
                createdAt: translatedAt,
                aiModel: 'gpt-4',
              },
            ],
          ]),
          staleRefIds: [],
        },
      )

      const { meta } = await service.collectArticleTranslations({
        articles,
        targetLang: 'en',
        fields: ['title', 'text', 'content'],
      })

      expect(meta.size).toBe(1)
      const entry = meta.get('a1')!
      expect(entry.article).toBeDefined()
      expect(entry.article!.isTranslated).toBe(true)
      expect(entry.article!.sourceLang).toBe('zh')
      expect(entry.article!.targetLang).toBe('en')
      expect(entry.article!.translatedAt).toEqual(translatedAt)
      expect(entry.article!.model).toBe('gpt-4')
      expect((entry.article as any).title).toBeUndefined()
      expect((entry.article as any).text).toBeUndefined()
      expect((entry.article as any).content).toBeUndefined()
      expect((entry.article as any).contentFormat).toBeUndefined()
    })

    it('returns per-id TranslationResult in results map', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        {
          validTranslations: new Map([
            [
              'a1',
              {
                title: 'T1',
                text: 'X1',
                sourceLang: 'zh',
                lang: 'en',
                createdAt: new Date(),
              },
            ],
          ]),
          staleRefIds: [],
        },
      )

      const { results } = await service.collectArticleTranslations({
        articles,
        targetLang: 'en',
        fields: ['title', 'text'],
      })

      expect(results.size).toBe(2)
      const r1 = results.get('a1')!
      expect(r1.isTranslated).toBe(true)
      expect(r1.title).toBe('T1')
      const r2 = results.get('a2')!
      expect(r2.isTranslated).toBe(false)
    })

    it('omits untranslated items from meta map', async () => {
      mockAiTranslationService.getValidTranslationsForArticles.mockResolvedValue(
        {
          validTranslations: new Map(),
          staleRefIds: [],
        },
      )

      const { meta } = await service.collectArticleTranslations({
        articles,
        targetLang: 'en',
        fields: ['title'],
      })

      expect(meta.size).toBe(0)
    })
  })
})

describe('buildArticleTranslationMeta', () => {
  it('untranslated result — no content keys, availableTranslations empty array', () => {
    const result: TranslationResult = {
      title: 'T',
      text: 'X',
      isTranslated: false,
      sourceLang: 'zh',
      availableTranslations: [],
    }

    const meta = buildArticleTranslationMeta(result, 'en')

    expect(meta.isTranslated).toBe(false)
    expect(meta.sourceLang).toBe('zh')
    expect(meta.availableTranslations).toEqual([])
    expect(meta).not.toHaveProperty('title')
    expect(meta).not.toHaveProperty('text')
    expect(meta).not.toHaveProperty('content')
    expect(meta).not.toHaveProperty('contentFormat')
    expect(meta).not.toHaveProperty('subtitle')
    expect(meta).not.toHaveProperty('summary')
    expect(meta).not.toHaveProperty('tags')
  })

  it('translated result with full translationMeta', () => {
    const translatedAt = new Date()
    const result: TranslationResult = {
      title: 'T',
      text: 'X',
      isTranslated: true,
      sourceLang: 'zh',
      translationMeta: {
        sourceLang: 'zh',
        targetLang: 'en',
        translatedAt,
        model: 'claude-haiku',
      },
      availableTranslations: ['en', 'ja'],
    }

    const meta = buildArticleTranslationMeta(result, 'en')

    expect(meta.isTranslated).toBe(true)
    expect(meta.sourceLang).toBe('zh')
    expect(meta.targetLang).toBe('en')
    expect(meta.translatedAt).toBe(translatedAt)
    expect(meta.model).toBe('claude-haiku')
    expect(meta.availableTranslations).toEqual(['en', 'ja'])
    expect(meta).not.toHaveProperty('title')
    expect(meta).not.toHaveProperty('text')
    expect(meta).not.toHaveProperty('content')
  })

  it('translated result without translationMeta — targetLang falls back to lang param', () => {
    const result: TranslationResult = {
      title: 'T',
      text: 'X',
      isTranslated: true,
      sourceLang: 'zh',
    }

    const meta = buildArticleTranslationMeta(result, 'ja')

    expect(meta.targetLang).toBe('ja')
    expect(meta.translatedAt).toBeUndefined()
    expect(meta.model).toBeUndefined()
  })
})

describe('applyArticleTranslationInPlace', () => {
  const makeResult = (
    overrides: Partial<TranslationResult> = {},
  ): TranslationResult => ({
    title: 'Translated Title',
    text: 'Translated Text',
    subtitle: 'Translated Subtitle',
    summary: 'Translated Summary',
    tags: ['tag-en'],
    content: 'Translated Content',
    contentFormat: 'markdown',
    isTranslated: true,
    sourceLang: 'zh',
    ...overrides,
  })

  it('untranslated result — no-op', () => {
    const target = { title: 'Original', text: 'Original Text' }
    const result = makeResult({ isTranslated: false })

    applyArticleTranslationInPlace(target, result)

    expect(target.title).toBe('Original')
    expect(target.text).toBe('Original Text')
  })

  it('translated result overwrites all seven fields by default', () => {
    const target: any = {
      title: 'O',
      text: 'O',
      subtitle: 'O',
      summary: 'O',
      tags: ['orig'],
      content: 'O',
      contentFormat: 'O',
    }

    applyArticleTranslationInPlace(target, makeResult())

    expect(target.title).toBe('Translated Title')
    expect(target.text).toBe('Translated Text')
    expect(target.subtitle).toBe('Translated Subtitle')
    expect(target.summary).toBe('Translated Summary')
    expect(target.tags).toEqual(['tag-en'])
    expect(target.content).toBe('Translated Content')
    expect(target.contentFormat).toBe('markdown')
  })

  it('empty-string text still overwrites (nullish, not truthy check)', () => {
    const target: any = { title: 'O', text: 'O' }

    applyArticleTranslationInPlace(target, makeResult({ text: '' }))

    expect(target.text).toBe('')
  })

  it('content present but contentFormat null — contentFormat retained from target', () => {
    const target: any = { content: 'O', contentFormat: 'lexical' }

    applyArticleTranslationInPlace(
      target,
      makeResult({ content: 'New Content', contentFormat: undefined }),
    )

    expect(target.content).toBe('New Content')
    expect(target.contentFormat).toBe('lexical')
  })

  it('content null but contentFormat present — neither overwritten', () => {
    const target: any = { content: 'O', contentFormat: 'lexical' }

    applyArticleTranslationInPlace(
      target,
      makeResult({ content: undefined, contentFormat: 'markdown' }),
    )

    expect(target.content).toBe('O')
    expect(target.contentFormat).toBe('lexical')
  })

  it('opts.fields = ["title"] — only title overwritten', () => {
    const target: any = {
      title: 'O',
      text: 'O',
      summary: 'O',
    }

    applyArticleTranslationInPlace(target, makeResult(), { fields: ['title'] })

    expect(target.title).toBe('Translated Title')
    expect(target.text).toBe('O')
    expect(target.summary).toBe('O')
  })
})

describe('applyTranslationEntriesInPlace', () => {
  const makeEmptyMaps = (): EntryMaps => ({
    entityMaps: new Map(),
    dictMaps: new Map(),
  })

  it('entity mode — hit overwrites leaf', () => {
    const target: any = { topic: { id: 'topic-1', name: 'Original Name' } }
    const maps = makeEmptyMaps()
    maps.entityMaps.set('topic.name', new Map([['topic-1', 'Translated Name']]))

    applyTranslationEntriesInPlace(target, maps, [
      {
        path: 'topic.name',
        keyPath: 'topic.name',
        mode: 'entity',
        idField: 'id',
      },
    ])

    expect(target.topic.name).toBe('Translated Name')
  })

  it('entity mode — miss retains leaf', () => {
    const target: any = { topic: { id: 'topic-2', name: 'Original Name' } }
    const maps = makeEmptyMaps()
    maps.entityMaps.set('topic.name', new Map([['topic-1', 'Translated Name']]))

    applyTranslationEntriesInPlace(target, maps, [
      {
        path: 'topic.name',
        keyPath: 'topic.name',
        mode: 'entity',
        idField: 'id',
      },
    ])

    expect(target.topic.name).toBe('Original Name')
  })

  it('entity mode — undefined intermediate path is no-op', () => {
    const target: any = { topic: undefined }

    applyTranslationEntriesInPlace(target, makeEmptyMaps(), [
      {
        path: 'topic.name',
        keyPath: 'topic.name',
        mode: 'entity',
        idField: 'id',
      },
    ])

    expect(target.topic).toBeUndefined()
  })

  it('dict mode — hit overwrites leaf', () => {
    const target: any = { mood: 'happy' }
    const maps = makeEmptyMaps()
    maps.dictMaps.set('note.mood', new Map([['happy', 'Glücklich']]))

    applyTranslationEntriesInPlace(target, maps, [
      { path: 'mood', keyPath: 'note.mood', mode: 'dict' },
    ])

    expect(target.mood).toBe('Glücklich')
  })

  it('dict mode — miss retains leaf', () => {
    const target: any = { mood: 'sad' }
    const maps = makeEmptyMaps()
    maps.dictMaps.set('note.mood', new Map([['happy', 'Glücklich']]))

    applyTranslationEntriesInPlace(target, maps, [
      { path: 'mood', keyPath: 'note.mood', mode: 'dict' },
    ])

    expect(target.mood).toBe('sad')
  })

  it('multiple rules on same target — all applied independently', () => {
    const target: any = {
      topic: { id: 'topic-1', name: 'OrigName' },
      mood: 'happy',
    }
    const maps = makeEmptyMaps()
    maps.entityMaps.set('topic.name', new Map([['topic-1', 'NewName']]))
    maps.dictMaps.set('note.mood', new Map([['happy', 'Fröhlich']]))

    applyTranslationEntriesInPlace(target, maps, [
      {
        path: 'topic.name',
        keyPath: 'topic.name',
        mode: 'entity',
        idField: 'id',
      },
      { path: 'mood', keyPath: 'note.mood', mode: 'dict' },
    ])

    expect(target.topic.name).toBe('NewName')
    expect(target.mood).toBe('Fröhlich')
  })
})
