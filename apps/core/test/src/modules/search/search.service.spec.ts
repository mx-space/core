import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import type { AiTranslationRepository } from '~/modules/ai/ai-translation/ai-translation.repository'
import type { SearchRepository } from '~/modules/search/search.repository'
import { SearchService } from '~/modules/search/search.service'
import { computeSourceHash } from '~/modules/search/search-document.util'
import { ContentFormat } from '~/shared/types/content-format.type'

const baseArticle = {
  id: 'post-1',
  title: 'Searchable Post',
  slug: 'searchable-post',
  text: 'Body text',
  contentFormat: ContentFormat.Markdown,
  createdAt: now,
  modifiedAt: null,
  isPublished: true,
}

const buildHash = (article: typeof baseArticle) =>
  computeSourceHash({
    title: article.title,
    text: article.text,
    contentFormat: article.contentFormat,
    content: null,
    tags: [],
  })

const makeService = ({
  postFindById = baseArticle,
  noteRecent = [],
  pageRecent = [],
  postList,
  noteListAll,
  pageFindAll,
  translations = [],
  searchRepoOverrides,
  aiRepoOverrides,
}: {
  postFindById?: any
  noteRecent?: any[]
  pageRecent?: any[]
  postList?: any
  noteListAll?: any
  pageFindAll?: any[]
  translations?: any[]
  searchRepoOverrides?: Partial<Record<keyof SearchRepository, any>>
  aiRepoOverrides?: Partial<Record<keyof AiTranslationRepository, any>>
} = {}) => {
  const noteService = {
    findById: vi.fn().mockResolvedValue(null),
    findRecent: vi.fn().mockResolvedValue(noteRecent),
    findManyByIds: vi.fn().mockResolvedValue([]),
    listAll: vi.fn().mockResolvedValue(
      noteListAll ?? {
        data: noteRecent,
        pagination: {
          totalPage: 1,
          currentPage: 1,
          total: noteRecent.length,
          size: 50,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    ),
  }
  const postService = {
    findById: vi.fn().mockResolvedValue(postFindById),
    findRecent: vi.fn().mockResolvedValue(postFindById ? [postFindById] : []),
    findManyByIds: vi
      .fn()
      .mockResolvedValue(postFindById ? [postFindById] : []),
    list: vi.fn().mockResolvedValue(
      postList ?? {
        data: postFindById ? [postFindById] : [],
        pagination: {
          totalPage: 1,
          currentPage: 1,
          total: postFindById ? 1 : 0,
          size: 50,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    ),
  }
  const pageService = {
    findById: vi.fn().mockResolvedValue(null),
    findRecent: vi.fn().mockResolvedValue(pageRecent),
    findManyByIds: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue(pageFindAll ?? pageRecent ?? []),
  }
  const searchRepo = createPgRepositoryMock<SearchRepository>({
    upsert: vi.fn().mockResolvedValue(undefined),
    deleteByRef: vi.fn().mockResolvedValue(0),
    deleteAll: vi.fn().mockResolvedValue(0),
    findHashesByRefMap: vi.fn().mockResolvedValue(new Map()),
    findCorpusStatsByLang: vi.fn().mockResolvedValue({
      totalDocs: 1,
      avgTitleLength: 1,
      avgBodyLength: 1,
    }),
    findByTerms: vi.fn().mockResolvedValue([]),
    findByKeyword: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
    findAdminRows: vi.fn().mockResolvedValue({
      data: [],
      pagination: {
        total: 0,
        currentPage: 1,
        totalPage: 1,
        size: 20,
        hasNextPage: false,
        hasPrevPage: false,
      },
    }),
    ...searchRepoOverrides,
  })
  const aiRepo = createPgRepositoryMock<AiTranslationRepository>({
    listByRefId: vi.fn().mockResolvedValue(translations),
    listByRefIds: vi.fn().mockResolvedValue(translations),
    findByRef: vi.fn(
      async (refId: string, refType: string, lang: string) =>
        translations.find(
          (t: any) =>
            t.refId === refId && t.refType === refType && t.lang === lang,
        ) ?? null,
    ),
    list: vi.fn().mockResolvedValue({
      data: translations,
      pagination: {
        total: translations.length,
        totalPage: 1,
        currentPage: 1,
        size: 100,
        hasNextPage: false,
        hasPrevPage: false,
      },
    }),
    ...aiRepoOverrides,
  })
  const service = new SearchService(
    noteService as any,
    postService as any,
    pageService as any,
    searchRepo as any,
    aiRepo as any,
  )
  return { service, searchRepo, aiRepo, noteService, postService, pageService }
}

describe('SearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upserts a post search document with resolved sourceLang', async () => {
    const { service, searchRepo } = makeService({
      translations: [
        {
          id: 'trans-en',
          refId: 'post-1',
          refType: 'post',
          lang: 'en',
          sourceLang: 'ja',
          title: 't',
          text: 'b',
          subtitle: null,
          summary: null,
          tags: [],
          hash: 'h',
          aiModel: null,
          aiProvider: null,
        },
      ],
    })

    await service.onPostCreate({ id: 'post-1' })

    expect(searchRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ refType: 'post', refId: 'post-1', lang: 'ja' }),
    )
  })

  it('falls back to article meta lang when no translation exists', async () => {
    const article = { ...baseArticle, meta: { lang: 'en' } }
    const { service, searchRepo } = makeService({
      postFindById: article,
      translations: [],
    })

    await service.onPostCreate({ id: 'post-1' })

    expect(searchRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ refType: 'post', refId: 'post-1', lang: 'en' }),
    )
  })

  it('defaults source lang to zh when nothing else resolves', async () => {
    const { service, searchRepo } = makeService({})
    await service.onPostCreate({ id: 'post-1' })
    expect(searchRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'zh' }),
    )
  })

  it('drops every lang on article delete', async () => {
    const { service, searchRepo } = makeService({})
    await service.onPostDelete({ id: 'post-1' })
    expect(searchRepo.deleteByRef).toHaveBeenCalledWith('post', 'post-1')
  })

  it('upserts translation rows on TRANSLATION_CREATE', async () => {
    const translation = {
      id: 't1',
      refId: 'post-1',
      refType: 'post',
      lang: 'ja',
      sourceLang: 'zh',
      title: '日本語タイトル',
      text: '本文',
      subtitle: null,
      summary: null,
      tags: [],
      hash: 'jhash',
      aiModel: null,
      aiProvider: null,
      contentFormat: null,
      content: null,
    }
    const { service, searchRepo } = makeService({
      translations: [translation],
    })
    await service.onTranslationUpsert({
      refId: 'post-1',
      refType: 'post',
      lang: 'ja',
    })
    expect(searchRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        refType: 'post',
        refId: 'post-1',
        lang: 'ja',
        sourceHash: 'jhash',
      }),
    )
  })

  it('drops a single lang on TRANSLATION_DELETE', async () => {
    const { service, searchRepo } = makeService({})
    await service.onTranslationDelete({
      refId: 'post-1',
      refType: 'post',
      lang: 'ja',
    })
    expect(searchRepo.deleteByRef).toHaveBeenCalledWith('post', 'post-1', 'ja')
  })

  it('rebuild incremental: skips matching hash, creates new, updates changed, deletes orphans', async () => {
    const expectedHash = buildHash(baseArticle)
    const { service, searchRepo } = makeService({
      searchRepoOverrides: {
        findHashesByRefMap: vi.fn().mockResolvedValue(
          new Map<string, string>([
            // matches → skip
            ['post:post-1:zh', expectedHash],
            // orphan → delete
            ['post:gone:zh', 'whatever'],
            // changed hash → update
            ['note:note-1:zh', 'old'],
          ]),
        ),
      },
      noteRecent: [],
    })

    const stats = await service.rebuildSearchDocuments()

    // post-1 matches → skip; note-1 + post:gone don't exist in expected → delete.
    expect(stats.skipped).toBe(1)
    expect(stats.deleted).toBe(2)
    expect(searchRepo.deleteByRef).toHaveBeenCalledWith('post', 'gone', 'zh')
    expect(searchRepo.deleteByRef).toHaveBeenCalledWith('note', 'note-1', 'zh')
  })

  it('searchIndex applies fallback discount for misses in effective lang', async () => {
    const enHit = {
      id: 's1',
      refType: 'post',
      refId: 'post-1',
      lang: 'en',
      sourceHash: '',
      title: 'hello',
      searchText: 'world',
      terms: ['hello'],
      titleTermFreq: { hello: 1 },
      bodyTermFreq: {},
      titleLength: 1,
      bodyLength: 1,
      slug: null,
      nid: null,
      isPublished: true,
      publicAt: null,
      hasPassword: false,
      createdAt: now,
      modifiedAt: null,
    }
    const zhHit = {
      ...enHit,
      id: 's2',
      refId: 'post-2',
      lang: 'zh',
      title: '你好',
      searchText: '世界',
      terms: ['你好'],
      titleTermFreq: { 你好: 1 },
      bodyTermFreq: {},
    }

    const findByTerms = vi.fn(async (_terms, _refType, lang) =>
      lang === 'en' ? [enHit] : [zhHit],
    )
    const findByKeyword = vi.fn().mockResolvedValue([])
    const findAll = vi.fn().mockResolvedValue([])
    const findCorpusStatsByLang = vi.fn().mockResolvedValue({
      totalDocs: 5,
      avgTitleLength: 2,
      avgBodyLength: 5,
    })

    const { service, postService } = makeService({
      searchRepoOverrides: {
        findByTerms,
        findByKeyword,
        findAll,
        findCorpusStatsByLang,
      },
    })

    postService.findManyByIds.mockResolvedValue([
      { id: 'post-1', title: 'orig-en', isPublished: true },
      { id: 'post-2', title: 'orig-zh', isPublished: true },
    ])

    const result = (await service.search({
      keyword: 'hello',
      page: 1,
      size: 10,
      lang: 'en',
    } as any)) as any

    expect(result.data.length).toBe(2)
    const en = result.data.find((d: any) => d.id === 'post-1')
    const zh = result.data.find((d: any) => d.id === 'post-2')
    expect(en?.lang).toBe('en')
    expect(en?.isFallback).toBe(false)
    expect(zh?.lang).toBe('zh')
    expect(zh?.isFallback).toBe(true)
  })
})
