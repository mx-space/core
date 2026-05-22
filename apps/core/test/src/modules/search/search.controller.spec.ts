import { describe, expect, it, vi } from 'vitest'

import type { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { SearchController } from '~/modules/search/search.controller'
import type { SearchService } from '~/modules/search/search.service'

const makeEntryMaps = (
  entityMaps: Record<string, Record<string, string>> = {},
) => ({
  entityMaps: new Map(
    Object.entries(entityMaps).map(([k, v]) => [k, new Map(Object.entries(v))]),
  ),
  dictMaps: new Map<string, Map<string, string>>(),
})

const makePagination = (total = 0) => ({
  total,
  currentPage: 1,
  totalPage: 1,
  size: 10,
  hasNextPage: false,
  hasPrevPage: false,
})

const createController = (
  opts: {
    searchResult?: { data: any[]; pagination: any }
    entryMaps?: ReturnType<typeof makeEntryMaps>
  } = {},
) => {
  const {
    searchResult = { data: [], pagination: makePagination() },
    entryMaps = makeEntryMaps(),
  } = opts

  const searchService: Partial<SearchService> = {
    search: vi.fn().mockResolvedValue({ ...searchResult }),
    searchPost: vi.fn().mockResolvedValue({ ...searchResult }),
    searchNote: vi.fn().mockResolvedValue({ ...searchResult }),
    searchPage: vi.fn().mockResolvedValue({ ...searchResult }),
  }

  const translationEntryService: Partial<TranslationEntryService> = {
    getTranslationsBatch: vi.fn().mockResolvedValue(entryMaps),
  }

  const controller = new SearchController(
    searchService as any,
    translationEntryService as any,
  )

  return { controller, searchService, translationEntryService }
}

describe('SearchController', () => {
  describe('GET /', () => {
    it('translates category.name on post items when lang is set', async () => {
      const items = [
        {
          type: 'post',
          id: 'p1',
          title: 'Post 1',
          category: { id: 'cat-1', name: 'Original' },
        },
        { type: 'note', id: 'n1', title: 'Note 1' },
        { type: 'page', id: 'pg1', title: 'Page 1' },
        { type: 'post', id: 'p2', title: 'Post 2', category: null },
      ]

      const { controller } = createController({
        searchResult: {
          data: items.map((i) => ({
            ...i,
            category: i.category ? { ...i.category } : i.category,
          })),
          pagination: makePagination(4),
        },
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-1': 'EN Category' },
        }),
      })

      const result = await controller.search({} as any, 'en')

      expect((result as any).data[0].category.name).toBe('EN Category')
    })

    it('leaves note and page items untouched', async () => {
      const items = [
        {
          type: 'post',
          id: 'p1',
          title: 'Post',
          category: { id: 'cat-1', name: 'Original' },
        },
        { type: 'note', id: 'n1', title: 'Note' },
        { type: 'page', id: 'pg1', title: 'Page' },
      ]

      const { controller } = createController({
        searchResult: {
          data: items.map((i) => ({ ...i })),
          pagination: makePagination(3),
        },
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-1': 'EN Category' },
        }),
      })

      const result = await controller.search({} as any, 'en')

      expect((result as any).data[1]).not.toHaveProperty('category')
      expect((result as any).data[2]).not.toHaveProperty('category')
    })

    it('leaves items without category untouched', async () => {
      const items = [
        { type: 'post', id: 'p1', title: 'Post no cat' },
        { type: 'post', id: 'p2', title: 'Post null cat', category: null },
      ]

      const { controller } = createController({
        searchResult: {
          data: items.map((i) => ({ ...i })),
          pagination: makePagination(2),
        },
        entryMaps: makeEntryMaps(),
      })

      const result = await controller.search({} as any, 'en')

      expect((result as any).data[0].title).toBe('Post no cat')
      expect((result as any).data[1].category).toBeNull()
    })

    it('emits no meta.translation block', async () => {
      const items = [
        {
          type: 'post',
          id: 'p1',
          title: 'Post',
          category: { id: 'cat-1', name: 'Original' },
        },
      ]

      const { controller } = createController({
        searchResult: {
          data: items.map((i) => ({ ...i, category: { ...i.category } })),
          pagination: makePagination(1),
        },
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-1': 'EN Category' },
        }),
      })

      const result = await controller.search({} as any, 'en')

      expect((result as any).meta?.translation).toBeUndefined()
    })

    it('does not call getTranslationsBatch when lang is absent', async () => {
      const items = [
        {
          type: 'post',
          id: 'p1',
          title: 'Post',
          category: { id: 'cat-1', name: 'Original' },
        },
      ]

      const { controller, translationEntryService } = createController({
        searchResult: {
          data: items.map((i) => ({ ...i })),
          pagination: makePagination(1),
        },
      })

      await controller.search({} as any, undefined)

      expect(
        translationEntryService.getTranslationsBatch,
      ).not.toHaveBeenCalled()
    })
  })

  describe('GET /:type', () => {
    it('translates category.name on post items when type=post and lang is set', async () => {
      const items = [
        {
          id: 'p1',
          title: 'Post 1',
          category: { id: 'cat-1', name: 'Original' },
        },
        { id: 'p2', title: 'Post 2' },
      ]

      const { controller } = createController({
        searchResult: {
          data: items.map((i) => ({
            ...i,
            category: i.category ? { ...i.category } : undefined,
          })),
          pagination: makePagination(2),
        },
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-1': 'EN Category' },
        }),
      })

      const result = await controller.searchByType({} as any, 'post', 'en')

      expect((result as any).data[0].category.name).toBe('EN Category')
    })

    it('does not translate for note type', async () => {
      const items = [{ id: 'n1', title: 'Note 1' }]

      const { controller, translationEntryService } = createController({
        searchResult: {
          data: items.map((i) => ({ ...i })),
          pagination: makePagination(1),
        },
      })

      await controller.searchByType({} as any, 'note', 'en')

      expect(
        translationEntryService.getTranslationsBatch,
      ).not.toHaveBeenCalled()
    })

    it('does not translate for page type', async () => {
      const items = [{ id: 'pg1', title: 'Page 1' }]

      const { controller, translationEntryService } = createController({
        searchResult: {
          data: items.map((i) => ({ ...i })),
          pagination: makePagination(1),
        },
      })

      await controller.searchByType({} as any, 'page', 'en')

      expect(
        translationEntryService.getTranslationsBatch,
      ).not.toHaveBeenCalled()
    })

    it('emits no meta.translation block', async () => {
      const items = [
        {
          id: 'p1',
          title: 'Post 1',
          category: { id: 'cat-1', name: 'Original' },
        },
      ]

      const { controller } = createController({
        searchResult: {
          data: items.map((i) => ({ ...i, category: { ...i.category } })),
          pagination: makePagination(1),
        },
        entryMaps: makeEntryMaps({
          'category.name': { 'cat-1': 'EN Category' },
        }),
      })

      const result = await controller.searchByType({} as any, 'post', 'en')

      expect((result as any).meta?.translation).toBeUndefined()
    })

    it('does not call getTranslationsBatch when lang is absent', async () => {
      const items = [
        {
          id: 'p1',
          title: 'Post',
          category: { id: 'cat-1', name: 'Original' },
        },
      ]

      const { controller, translationEntryService } = createController({
        searchResult: {
          data: items.map((i) => ({ ...i })),
          pagination: makePagination(1),
        },
      })

      await controller.searchByType({} as any, 'post', undefined)

      expect(
        translationEntryService.getTranslationsBatch,
      ).not.toHaveBeenCalled()
    })
  })
})
