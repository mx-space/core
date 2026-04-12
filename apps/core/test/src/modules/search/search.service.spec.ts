import { Test } from '@nestjs/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { NoteService } from '~/modules/note/note.service'
import { PageService } from '~/modules/page/page.service'
import { SearchService } from '~/modules/search/search.service'
import { SearchDocumentModel } from '~/modules/search/search-document.model'
import { getModelToken } from '~/transformers/model.transformer'

describe('SearchService', () => {
  let searchService: SearchService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: NoteService, useValue: { model: {} } },
        { provide: POST_SERVICE_TOKEN, useValue: { model: {} } },
        { provide: PageService, useValue: { model: {} } },
        {
          provide: getModelToken(SearchDocumentModel.name),
          useValue: {},
        },
      ],
    }).compile()

    searchService = module.get(SearchService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should prefer exact title matches over body-only matches', () => {
    const keywordRegexes = (searchService as any).buildSearchKeywordRegexes(
      'hello',
    )
    const searchTerms = (searchService as any).buildSearchTerms('hello')

    const ranked = (searchService as any).rankSearchHits(
      [
        {
          refType: 'note',
          refId: 'note-a',
          title: 'hello',
          searchText: 'world',
          titleTermFreq: { hello: 1 },
          bodyTermFreq: { world: 1 },
          titleLength: 1,
          bodyLength: 1,
          created: new Date('2024-01-01'),
        },
        {
          refType: 'note',
          refId: 'note-b',
          title: 'world',
          searchText: 'hello hello hello',
          titleTermFreq: { world: 1 },
          bodyTermFreq: { hello: 3 },
          titleLength: 1,
          bodyLength: 3,
          created: new Date('2024-01-02'),
        },
        {
          refType: 'note',
          refId: 'note-c',
          title: 'hello world',
          searchText: 'hello',
          titleTermFreq: { hello: 1, world: 1 },
          bodyTermFreq: { hello: 1 },
          titleLength: 2,
          bodyLength: 1,
          created: new Date('2024-01-03'),
        },
      ],
      keywordRegexes,
      searchTerms,
      { totalDocs: 3, avgTitleLength: 1.33, avgBodyLength: 1.66 },
      new Map([['hello', 3]]),
    )

    expect(ranked.map((item) => item.refId)).toEqual([
      'note-a',
      'note-c',
      'note-b',
    ])
  })

  it('should escape special regex characters in keyword', () => {
    const keywordRegexes = (searchService as any).buildSearchKeywordRegexes(
      'hello.*',
    )

    expect(keywordRegexes).toHaveLength(1)
    expect(keywordRegexes[0].source).toBe('hello\\.\\*')
    expect(
      (searchService as any).countKeywordMatches(
        'hello world',
        keywordRegexes[0],
      ),
    ).toBe(0)
    expect(
      (searchService as any).countKeywordMatches(
        'hello.* world',
        keywordRegexes[0],
      ),
    ).toBe(1)
  })

  it('should tokenize cjk text into searchable terms', () => {
    const searchTerms = (searchService as any).buildSearchTerms('中文搜索')

    expect(searchTerms).toContain('中')
    expect(searchTerms).toContain('中文')
    expect(searchTerms).toContain('搜索')
    expect(searchTerms).toContain('中文搜索')
  })

  it('should generate compact highlight keywords and snippet for cjk search', () => {
    const highlight = (searchService as any).buildSearchHighlight(
      {
        refType: 'post',
        refId: 'post-1',
        title: '关于中文搜索',
        searchText: '这里记录了中文搜索功能的实现细节以及 bm25 重排。',
        titleTermFreq: { 关于: 1, 中文: 1, 搜索: 1, 中文搜索: 1 },
        bodyTermFreq: {
          这里: 1,
          记录: 1,
          中文: 1,
          搜索: 1,
          中文搜索: 1,
          功能: 1,
        },
      },
      ['中文搜索'],
      (searchService as any).buildSearchTerms('中文搜索'),
    )

    expect(highlight.keywords).toEqual(['中文搜索'])
    expect(highlight.snippet).toContain('中文搜索')
  })

  it('should prefer lexical content over stale text when building search document', () => {
    const document = (searchService as any).toSearchDocument('post', {
      id: 'post-lexical',
      title: '富文本文章',
      text: '旧摘要',
      contentFormat: 'lexical',
      content: JSON.stringify({
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: '最新富文本正文' }],
            },
          ],
        },
      }),
    })

    expect(document.searchText).toContain('最新富文本正文')
    expect(document.searchText).not.toContain('旧摘要')
    expect(document.terms).toContain('最新富文本正文')
    expect(document.bodyTermFreq.最新富文本正文).toBe(1)
  })
})
