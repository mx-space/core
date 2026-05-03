import { describe, expect, it } from 'vitest'

import { buildSearchDocument } from '~/modules/search/search-document.util'
import { ContentFormat } from '~/shared/types/content-format.type'

describe('post content format regression', () => {
  it('keeps markdown text available for PG search documents', () => {
    const document = buildSearchDocument('post', {
      id: 'post-1',
      title: 'markdown post',
      slug: 'markdown-post',
      text: '# Heading\n\nBody',
      contentFormat: ContentFormat.Markdown,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      modifiedAt: null,
    })

    expect(document).toMatchObject({
      refId: 'post-1',
      refType: 'post',
      title: 'markdown post',
      searchText: expect.stringContaining('heading'),
    })
  })

  it('extracts text from lexical JSON content for PG search documents', () => {
    const lexical = JSON.stringify({
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Lexical body' }],
          },
        ],
      },
    })

    const document = buildSearchDocument('post', {
      id: 'post-1',
      title: 'Lexical Post',
      slug: 'lexical-post',
      text: lexical,
      content: lexical,
      contentFormat: ContentFormat.Lexical,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      modifiedAt: null,
    })

    expect(document.searchText).toContain('lexical body')
  })
})
