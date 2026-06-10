import { describe, expect, it, vi } from 'vitest'

import type { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { CategoryController } from '~/modules/category/category.controller'
import type { CategoryService } from '~/modules/category/category.service'
import type { TranslationService } from '~/processors/helper/helper.translation.service'

const makeEntryMaps = (
  entityMaps: Record<string, Record<string, string>> = {},
) => ({
  entityMaps: new Map(
    Object.entries(entityMaps).map(([k, v]) => [k, new Map(Object.entries(v))]),
  ),
  dictMaps: new Map<string, Map<string, string>>(),
})

const makeCollectResult = (
  translatedMap: Record<string, { title: string }> = {},
) => {
  const results = new Map<string, any>(
    Object.entries(translatedMap).map(([id, fields]) => [
      id,
      { isTranslated: true, title: fields.title },
    ]),
  )
  const meta = new Map<string, any>(
    Object.entries(translatedMap).map(([id]) => [
      id,
      { article: { isTranslated: true, sourceLang: 'zh', targetLang: 'en' } },
    ]),
  )
  return { results, meta }
}

const NOW = new Date('2024-01-01T00:00:00Z')

const createController = (
  opts: {
    categories?: any[]
    posts?: Record<string, any[]>
    entryMaps?: ReturnType<typeof makeEntryMaps>
    collectResult?: ReturnType<typeof makeCollectResult>
    categoryById?: any
  } = {},
) => {
  const {
    categories = [],
    posts = {},
    entryMaps = makeEntryMaps(),
    collectResult = makeCollectResult(),
    categoryById = null,
  } = opts

  const categoryService: Partial<CategoryService> = {
    findAllCategory: vi.fn().mockResolvedValue(categories),
    getPostTagsSum: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(categoryById),
    findBySlug: vi.fn().mockResolvedValue(categoryById),
    findCategoryById: vi.fn().mockImplementation(async (id: string) => {
      return categories.find((c) => String(c.id) === id) ?? null
    }),
    findCategoryPost: vi.fn().mockResolvedValue([]),
    getCategoryTagsSum: vi.fn().mockResolvedValue([]),
    findArticleWithTag: vi.fn().mockResolvedValue([]),
  }
  Object.defineProperty(categoryService, 'repository', {
    value: {
      findByIds: vi.fn().mockImplementation(async (ids: string[]) => {
        return ids
          .map((id) => categories.find((c) => String(c.id) === String(id)))
          .filter(Boolean)
      }),
    },
  })

  const postService = {
    listByCategory: vi.fn().mockImplementation(async (id: string) => {
      return (posts[id] ?? []).map((p) => ({ ...p }))
    }),
    countByCategoryId: vi.fn().mockResolvedValue(0),
  }

  const translationService: Partial<TranslationService> = {
    collectArticleTranslations: vi.fn().mockResolvedValue(collectResult),
  }

  const translationEntryService: Partial<TranslationEntryService> = {
    getTranslationsBatch: vi.fn().mockResolvedValue(entryMaps),
  }

  const controller = new CategoryController(
    categoryService as any,
    postService as any,
    translationService as any,
    translationEntryService as any,
  )

  return {
    controller,
    categoryService,
    postService,
    translationService,
    translationEntryService,
  }
}

describe('CategoryController', () => {
  describe('GET / by type (no ids)', () => {
    it('overwrites each category name in-place when entries exist', async () => {
      const cats = [
        { id: 'cat-1', name: 'Original 1' },
        { id: 'cat-2', name: 'Original 2' },
      ]
      const { controller } = createController({
        categories: cats,
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-1': 'EN Name 1', 'cat-2': 'EN Name 2' },
        }),
      })

      const result = await controller.getCategories(
        { type: undefined } as any,
        'en',
      )

      expect((result as any).data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'cat-1', name: 'EN Name 1' }),
          expect.objectContaining({ id: 'cat-2', name: 'EN Name 2' }),
        ]),
      )
    })

    it('preserves original name when no translation entry exists', async () => {
      const cats = [{ id: 'cat-1', name: 'Original 1' }]
      const { controller } = createController({
        categories: cats,
        entryMaps: makeEntryMaps(),
      })

      const result = await controller.getCategories(
        { type: undefined } as any,
        'en',
      )

      expect((result as any).data[0].name).toBe('Original 1')
    })

    it('emits no meta.translation block', async () => {
      const cats = [{ id: 'cat-1', name: 'Original 1' }]
      const { controller } = createController({
        categories: cats,
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-1': 'EN Name 1' },
        }),
      })

      const result = await controller.getCategories(
        { type: undefined } as any,
        'en',
      )

      expect((result as any).meta?.translation).toBeUndefined()
    })

    it('does not call getTranslationsBatch when lang is absent', async () => {
      const { controller, translationEntryService } = createController({
        categories: [{ id: 'cat-1', name: 'X' }],
      })

      await controller.getCategories({ type: undefined } as any, undefined)

      expect(
        translationEntryService.getTranslationsBatch,
      ).not.toHaveBeenCalled()
    })
  })

  describe('GET /:query regular (no tag)', () => {
    it('overwrites data.name and children[].title when translations exist', async () => {
      const cat = { id: 'cat-1', name: 'Category 1' }
      const children = [
        { id: 'post-1', title: 'Post 1', createdAt: NOW, modifiedAt: null },
        { id: 'post-2', title: 'Post 2', createdAt: NOW, modifiedAt: null },
      ]

      const { controller } = createController({
        categoryById: cat,
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-1': 'EN Category' },
        }),
        collectResult: makeCollectResult({
          'post-1': { title: 'EN Post 1' },
          'post-2': { title: 'EN Post 2' },
        }),
      })

      ;(controller as any).categoryService.findCategoryPost = vi
        .fn()
        .mockResolvedValue(children.map((c) => ({ ...c })))

      const result = await controller.getCategoryById(
        { query: 'cat-1' } as any,
        {} as any,
        'en',
      )

      expect((result as any).data.name).toBe('EN Category')
      expect((result as any).data.children[0].title).toBe('EN Post 1')
      expect((result as any).data.children[1].title).toBe('EN Post 2')
    })

    it('emits meta.translation only for translated children', async () => {
      const cat = { id: 'cat-1', name: 'Category 1' }
      const children = [
        { id: 'post-1', title: 'Post 1', createdAt: NOW, modifiedAt: null },
      ]

      const { controller } = createController({
        categoryById: cat,
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-1': 'EN Category' },
        }),
        collectResult: makeCollectResult({ 'post-1': { title: 'EN Post 1' } }),
      })

      ;(controller as any).categoryService.findCategoryPost = vi
        .fn()
        .mockResolvedValue(children.map((c) => ({ ...c })))

      const result = await controller.getCategoryById(
        { query: 'cat-1' } as any,
        {} as any,
        'en',
      )

      expect((result as any).meta?.translation).toBeDefined()
      expect((result as any).meta.translation['post-1']).toBeDefined()
    })

    it('emits no meta.translation when no children are translated', async () => {
      const cat = { id: 'cat-1', name: 'Category 1' }

      const { controller } = createController({
        categoryById: cat,
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-1': 'EN Category' },
        }),
        collectResult: makeCollectResult(),
      })

      const result = await controller.getCategoryById(
        { query: 'cat-1' } as any,
        {} as any,
        'en',
      )

      expect((result as any).meta?.translation).toBeUndefined()
    })

    it('preserves original name when no category.name entry exists', async () => {
      const cat = { id: 'cat-1', name: 'Category 1' }

      const { controller } = createController({
        categoryById: cat,
        entryMaps: makeEntryMaps(),
        collectResult: makeCollectResult(),
      })

      const result = await controller.getCategoryById(
        { query: 'cat-1' } as any,
        {} as any,
        'en',
      )

      expect((result as any).data.name).toBe('Category 1')
    })
  })

  describe('GET /:query with tag=true', () => {
    it('overwrites data[].title in-place when translations exist', async () => {
      const tagPosts = [
        { id: 'post-1', title: 'Tag Post 1', createdAt: NOW, modifiedAt: null },
        { id: 'post-2', title: 'Tag Post 2', createdAt: NOW, modifiedAt: null },
      ]

      const { controller } = createController({
        collectResult: makeCollectResult({
          'post-1': { title: 'EN Tag Post 1' },
          'post-2': { title: 'EN Tag Post 2' },
        }),
      })

      ;(controller as any).categoryService.findArticleWithTag = vi
        .fn()
        .mockResolvedValue(tagPosts.map((p) => ({ ...p })))

      const result = await controller.getCategoryById(
        { query: 'mytag' } as any,
        { tag: true } as any,
        'en',
      )

      expect((result as any).data.data[0].title).toBe('EN Tag Post 1')
      expect((result as any).data.data[1].title).toBe('EN Tag Post 2')
    })

    it('emits meta.translation only for translated items', async () => {
      const tagPosts = [
        { id: 'post-1', title: 'Tag Post 1', createdAt: NOW, modifiedAt: null },
      ]

      const { controller } = createController({
        collectResult: makeCollectResult({
          'post-1': { title: 'EN Tag Post 1' },
        }),
      })

      ;(controller as any).categoryService.findArticleWithTag = vi
        .fn()
        .mockResolvedValue(tagPosts.map((p) => ({ ...p })))

      const result = await controller.getCategoryById(
        { query: 'mytag' } as any,
        { tag: true } as any,
        'en',
      )

      expect((result as any).meta?.translation?.['post-1']).toBeDefined()
    })

    it('emits no meta.translation when no translations exist', async () => {
      const tagPosts = [
        { id: 'post-1', title: 'Tag Post 1', createdAt: NOW, modifiedAt: null },
      ]

      const { controller } = createController({
        collectResult: makeCollectResult(),
      })

      ;(controller as any).categoryService.findArticleWithTag = vi
        .fn()
        .mockResolvedValue(tagPosts.map((p) => ({ ...p })))

      const result = await controller.getCategoryById(
        { query: 'mytag' } as any,
        { tag: true } as any,
        'en',
      )

      expect((result as any).meta?.translation).toBeUndefined()
    })

    it('does not call collectArticleTranslations when lang is absent', async () => {
      const { controller, translationService } = createController()

      ;(controller as any).categoryService.findArticleWithTag = vi
        .fn()
        .mockResolvedValue([
          { id: 'post-1', title: 'T', createdAt: NOW, modifiedAt: null },
        ])

      await controller.getCategoryById(
        { query: 'mytag' } as any,
        { tag: true } as any,
        undefined,
      )

      expect(
        translationService.collectArticleTranslations,
      ).not.toHaveBeenCalled()
    })
  })

  describe('GET / with ids query', () => {
    it('translates children titles per-category and aggregates meta', async () => {
      const posts: Record<string, any[]> = {
        'cat-a': [
          { id: 'p1', title: 'Post A1', createdAt: NOW, modifiedAt: null },
        ],
        'cat-b': [
          { id: 'p2', title: 'Post B1', createdAt: NOW, modifiedAt: null },
        ],
      }
      const categories = [
        { id: 'cat-a', name: 'Cat A' },
        { id: 'cat-b', name: 'Cat B' },
      ]

      const { controller } = createController({
        categories,
        posts,
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-a': 'EN Cat A', 'cat-b': 'EN Cat B' },
        }),
        collectResult: makeCollectResult({
          p1: { title: 'EN Post A1' },
          p2: { title: 'EN Post B1' },
        }),
      })

      const result = await controller.getCategories(
        { ids: ['cat-a', 'cat-b'], joint: false } as any,
        'en',
      )

      const entries = (result as any).data.entries
      expect(entries['cat-a'].children[0].title).toBe('EN Post A1')
      expect(entries['cat-b'].children[0].title).toBe('EN Post B1')
    })

    it('also overwrites category name in non-joint mode', async () => {
      const posts: Record<string, any[]> = {
        'cat-a': [
          { id: 'p1', title: 'Post A1', createdAt: NOW, modifiedAt: null },
        ],
      }
      const categories = [{ id: 'cat-a', name: 'Cat A' }]

      const { controller } = createController({
        categories,
        posts,
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-a': 'EN Cat A' },
        }),
        collectResult: makeCollectResult({ p1: { title: 'EN Post A1' } }),
      })

      const result = await controller.getCategories(
        { ids: ['cat-a'], joint: false } as any,
        'en',
      )

      const entry = (result as any).data.entries['cat-a']
      expect(entry.name).toBe('EN Cat A')
    })

    it('aggregates meta.translation across all category children', async () => {
      const posts: Record<string, any[]> = {
        'cat-a': [
          { id: 'p1', title: 'Post A1', createdAt: NOW, modifiedAt: null },
        ],
        'cat-b': [
          { id: 'p2', title: 'Post B1', createdAt: NOW, modifiedAt: null },
        ],
      }
      const categories = [
        { id: 'cat-a', name: 'Cat A' },
        { id: 'cat-b', name: 'Cat B' },
      ]

      const { controller } = createController({
        categories,
        posts,
        entryMaps: makeEntryMaps(),
        collectResult: makeCollectResult({
          p1: { title: 'EN Post A1' },
          p2: { title: 'EN Post B1' },
        }),
      })

      const result = await controller.getCategories(
        { ids: ['cat-a', 'cat-b'], joint: false } as any,
        'en',
      )

      const translation = (result as any).meta?.translation
      expect(translation).toBeDefined()
      expect(translation['p1']).toBeDefined()
      expect(translation['p2']).toBeDefined()
    })

    it('does not call translation services when lang is absent', async () => {
      const posts: Record<string, any[]> = {
        'cat-a': [
          { id: 'p1', title: 'Post A1', createdAt: NOW, modifiedAt: null },
        ],
      }

      const { controller, translationService, translationEntryService } =
        createController({
          categories: [{ id: 'cat-a', name: 'Cat A' }],
          posts,
        })

      await controller.getCategories({ ids: ['cat-a'] } as any, undefined)

      expect(
        translationService.collectArticleTranslations,
      ).not.toHaveBeenCalled()
      expect(
        translationEntryService.getTranslationsBatch,
      ).not.toHaveBeenCalled()
    })
  })
})
