import { describe, expect, it } from 'vitest'

import {
  buildSearchDocument,
  computeSourceHash,
  computeTranslationSourceHash,
} from '~/modules/search/search-document.util'

describe('search-document.util', () => {
  it('should build normalized search document for cjk content', () => {
    const document = buildSearchDocument(
      'note',
      {
        id: 'note-1',
        title: '中文搜索',
        text: '这里记录中文搜索功能。',
        nid: 42,
        isPublished: true,
        password: '',
      },
      'zh',
    )

    expect(document.refId).toBe('note-1')
    expect(document.lang).toBe('zh')
    expect(document.terms).toContain('中文搜索')
    expect(document.titleTermFreq.中).toBe(1)
    expect(document.bodyTermFreq.中文).toBe(1)
    expect(document.hasPassword).toBe(false)
    expect(document.sourceHash).toMatch(/^[\da-f]{40}$/)
  })

  it('should extract searchable text from lexical content', () => {
    const document = buildSearchDocument(
      'post',
      {
        id: 'post-1',
        title: 'Lexical',
        text: '',
        contentFormat: 'lexical',
        content: JSON.stringify({
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: '富文本搜索' }],
              },
            ],
          },
        }),
      },
      'zh',
    )

    expect(document.searchText).toContain('富文本搜索')
    expect(document.terms).toContain('富文本搜索')
    expect(document.bodyTermFreq.富文本搜索).toBe(1)
  })

  it('emits stable source hashes regardless of tag order', () => {
    const a = computeSourceHash({
      title: 'T',
      text: 'B',
      tags: ['x', 'y'],
    })
    const b = computeSourceHash({
      title: 'T',
      text: 'B',
      tags: ['y', 'x'],
    })
    expect(a).toBe(b)
  })

  it('returns the underlying translation hash for translation rows', () => {
    expect(computeTranslationSourceHash({ hash: 'abc' })).toBe('abc')
  })

  it('builds english documents in their declared lang', () => {
    const document = buildSearchDocument(
      'post',
      {
        id: 'post-1',
        title: 'Hello world',
        text: 'lorem ipsum',
      },
      'en',
    )
    expect(document.lang).toBe('en')
    expect(document.title).toBe('hello world')
  })
})
