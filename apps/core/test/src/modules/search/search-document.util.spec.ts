import { describe, expect, it } from 'vitest'

import { buildSearchDocument } from '~/modules/search/search-document.util'

describe('search-document.util', () => {
  it('should build normalized search document for cjk content', () => {
    const document = buildSearchDocument('note', {
      id: 'note-1',
      title: '中文搜索',
      text: '这里记录中文搜索功能。',
      nid: 42,
      isPublished: true,
      password: '',
    })

    expect(document.refId).toBe('note-1')
    expect(document.terms).toContain('中文搜索')
    expect(document.titleTermFreq.中).toBe(1)
    expect(document.bodyTermFreq.中文).toBe(1)
    expect(document.hasPassword).toBe(false)
  })

  it('should extract searchable text from lexical content', () => {
    const document = buildSearchDocument('post', {
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
    })

    expect(document.searchText).toContain('富文本搜索')
    expect(document.terms).toContain('富文本搜索')
    expect(document.bodyTermFreq.富文本搜索).toBe(1)
  })
})
