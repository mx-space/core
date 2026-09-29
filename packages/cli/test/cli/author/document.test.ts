import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  applyAuthorBody,
  openAuthorDocument,
  persistAuthorSave,
  unifiedDiff,
} from '../../../src/cli/author/document'
import { parseEnvelope } from '../../../src/domain/envelope'

const fixture = (name: string) =>
  readFileSync(path.resolve(__dirname, '../../fixtures', name), 'utf8')

describe('openAuthorDocument', () => {
  it('opens an mxpost envelope as article and freezes the body', () => {
    const source = fixture('post.xml')
    const doc = openAuthorDocument('/tmp/article.xml', source)
    expect(doc.kind).toBe('envelope')
    expect(doc.variant).toBe('article')
    expect(doc.filePath).toBe('/tmp/article.xml')
    expect(doc.originalBody).toContain('<p>正文一</p>')
    expect(doc.lastFileText).toBe(source)
  })

  it('opens an mxnote envelope as note', () => {
    const doc = openAuthorDocument('/tmp/note.xml', fixture('note.xml'))
    expect(doc.kind).toBe('envelope')
    expect(doc.variant).toBe('note')
  })

  it('opens a raw fragment as article unless variant is overridden', () => {
    const source = '<p>hello</p>'
    expect(openAuthorDocument('/tmp/a.xml', source).variant).toBe('article')
    expect(openAuthorDocument('/tmp/a.xml', source, 'note').variant).toBe(
      'note',
    )
    expect(openAuthorDocument('/tmp/a.xml', source).kind).toBe('fragment')
    expect(openAuthorDocument('/tmp/a.xml', source).originalBody).toBe(source)
  })
})

describe('applyAuthorBody', () => {
  it('replaces only the content span of an envelope', () => {
    const source = fixture('post.xml')
    const doc = openAuthorDocument('/tmp/article.xml', source)
    const applied = applyAuthorBody(doc, '<p>rewritten</p>')
    const reparsed = parseEnvelope(applied.fileText, 'post')
    expect(reparsed.meta.title).toBe('题名')
    expect(reparsed.meta.slug).toBe('my-post')
    expect(reparsed.meta.tags).toEqual(['foo', 'bar'])
    expect(reparsed.contentXml).toContain('<p>rewritten</p>')
    expect(reparsed.contentXml).not.toContain('正文一')
    expect(applied.fileText.slice(0, source.indexOf('<content'))).toBe(
      source.slice(0, source.indexOf('<content')),
    )
    expect(applied.diffPath).toBe('/tmp/article.xml.diff')
  })

  it('replaces a raw fragment wholesale', () => {
    const doc = openAuthorDocument('/tmp/frag.xml', '<p>old</p>')
    const applied = applyAuthorBody(doc, '<p>new</p>')
    expect(applied.fileText).toBe('<p>new</p>')
    expect(applied.diff).toContain('-<p>old</p>')
    expect(applied.diff).toContain('+<p>new</p>')
  })

  it('keeps the diff against the frozen original across multiple saves', () => {
    const doc = openAuthorDocument('/tmp/article.xml', fixture('post.xml'))
    const first = applyAuthorBody(doc, '<p>one</p>')
    doc.lastFileText = first.fileText
    const second = applyAuthorBody(doc, '<p>two</p>')
    expect(second.diff).toContain('-<p>正文一</p>')
    expect(second.diff).toContain('+<p>two</p>')
    expect(second.diff).not.toContain('<p>one</p>')
  })
})

describe('unifiedDiff', () => {
  it('writes headers only when the body is unchanged', () => {
    const diff = unifiedDiff('<p>same</p>', '<p>same</p>', 'article.xml')
    expect(diff).toBe('--- article.xml (original)\n+++ article.xml (current)\n')
  })
})

describe('persistAuthorSave', () => {
  it('writes xml then diff via temp files and updates lastFileText', async () => {
    const files = new Map<string, string>()
    const renamed: string[] = []
    const doc = openAuthorDocument(
      '/tmp/article.xml',
      '<mxpost><meta><title>t</title></meta><content><p>old</p></content></mxpost>',
    )
    const applied = applyAuthorBody(doc, '<p>new</p>')
    await persistAuthorSave(doc, applied.fileText, applied.diff, {
      writeFile: async (filePath, data) => {
        files.set(filePath, data)
      },
      rename: async (from, to) => {
        const data = files.get(from)
        if (data === undefined) throw new Error(`missing ${from}`)
        files.set(to, data)
        files.delete(from)
        renamed.push(`${from}->${to}`)
      },
    })
    expect(files.get('/tmp/article.xml')).toBe(applied.fileText)
    expect(files.get('/tmp/article.xml.diff')).toBe(applied.diff)
    expect(doc.lastFileText).toBe(applied.fileText)
    expect(renamed).toEqual([
      '/tmp/article.xml.tmp->/tmp/article.xml',
      '/tmp/article.xml.diff.tmp->/tmp/article.xml.diff',
    ])
  })

  it('restores xml when the diff rename fails', async () => {
    const files = new Map<string, string>()
    const original = '<p>original</p>'
    const doc = openAuthorDocument('/tmp/frag.xml', original)
    const applied = applyAuthorBody(doc, '<p>new</p>')
    await expect(
      persistAuthorSave(doc, applied.fileText, applied.diff, {
        writeFile: async (filePath, data) => {
          files.set(filePath, data)
        },
        rename: async (from, to) => {
          if (to.endsWith('.diff')) throw new Error('disk full')
          const data = files.get(from)
          if (data === undefined) throw new Error(`missing ${from}`)
          files.set(to, data)
          files.delete(from)
        },
      }),
    ).rejects.toThrow('disk full')
    expect(files.get('/tmp/frag.xml')).toBe(original)
    expect(files.has('/tmp/frag.xml.diff')).toBe(false)
    expect(doc.lastFileText).toBe(original)
  })

  it('leaves both targets unchanged when a temp write fails', async () => {
    const files = new Map<string, string>([['/tmp/frag.xml', '<p>old</p>']])
    const doc = openAuthorDocument('/tmp/frag.xml', '<p>old</p>')
    const applied = applyAuthorBody(doc, '<p>new</p>')
    await expect(
      persistAuthorSave(doc, applied.fileText, applied.diff, {
        writeFile: async () => {
          throw new Error('eacces')
        },
        rename: async () => {
          throw new Error('should not rename')
        },
      }),
    ).rejects.toThrow('eacces')
    expect(files.get('/tmp/frag.xml')).toBe('<p>old</p>')
    expect(doc.lastFileText).toBe('<p>old</p>')
  })
})
