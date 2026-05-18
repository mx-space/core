import { describe, expect, it } from 'vitest'

import {
  renderPostList,
  renderDocumentEnvelope,
  renderReadableDocument,
} from '../../src/core/document-output'
import { parseToLexical } from '../../src/core/litexml-codec'

function lexicalContent(xml: string): string {
  return JSON.stringify(parseToLexical(xml))
}

describe('document output rendering', () => {
  it('renders post metadata and lexical content as LiteXML for readable output', () => {
    const rendered = renderReadableDocument('post', {
      id: '1',
      title: 'Readable Post',
      slug: 'readable-post',
      isPublished: true,
      category: { name: 'Tech', slug: 'tech' },
      tags: ['cli', 'ai'],
      summary: 'Short summary.',
      contentFormat: 'lexical',
      content: lexicalContent('<p>Hello world.</p>'),
    })

    expect(rendered).toContain('post')
    expect(rendered).toContain('title: Readable Post')
    expect(rendered).toContain('state: published')
    expect(rendered).toContain('category: Tech')
    expect(rendered).toContain('tags: cli, ai')
    expect(rendered).toContain('content_format: litexml')
    expect(rendered).toContain('<p>')
    expect(rendered).not.toContain('"root"')
  })

  it('renders note envelope with mxnote root and compact metadata', () => {
    const rendered = renderDocumentEnvelope('note', {
      title: 'Daily Note',
      slug: 'daily-note',
      is_published: false,
      topic: { slug: 'life', name: 'Life' },
      mood: 'calm',
      bookmark: true,
      content_format: 'markdown',
      content: '# Body',
    })

    expect(rendered).toContain('<mxnote>')
    expect(rendered).toContain('<topic>life</topic>')
    expect(rendered).toContain('<state>draft</state>')
    expect(rendered).toContain('<format>markdown</format>')
    expect(rendered).toContain('# Body')
  })

  it('keeps post tags as LiteXML child elements in envelopes', () => {
    const rendered = renderDocumentEnvelope('post', {
      title: 'Tagged Post',
      slug: 'tagged-post',
      isPublished: true,
      tags: ['cli', 'ai'],
      contentFormat: 'markdown',
      content: 'Body',
    })

    expect(rendered).toContain('<tags>')
    expect(rendered).toContain('<tag>cli</tag>')
    expect(rendered).toContain('<tag>ai</tag>')
    expect(rendered).not.toContain('<tags>cli,ai</tags>')
  })

  it('renders post lists as concise readable rows for LLM output', () => {
    const rendered = renderPostList({
      data: [
        {
          id: '1',
          title: 'Translated Title',
          slug: 'translated-title',
          isTranslated: true,
          sourceLang: 'zh-CN',
          isPublished: true,
          category: { name: 'Tech' },
          tags: ['cli', 'llm'],
          summary: 'Short summary.',
        },
      ],
      pagination: { page: 1, size: 10, total: 1 },
    })

    expect(rendered).toContain('posts')
    expect(rendered).toContain('count: 1')
    expect(rendered).toContain('page: 1')
    expect(rendered).toContain('post 1:')
    expect(rendered).toContain('title: Translated Title')
    expect(rendered).toContain('category: Tech')
    expect(rendered).toContain('tags: cli, llm')
    expect(rendered).toContain('translated: true')
    expect(rendered).not.toContain('content:')
  })
})
