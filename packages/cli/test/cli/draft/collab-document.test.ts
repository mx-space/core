import { createContentDoc, readDocContent } from '@mx-space/editor/loro'
import { describe, expect, it } from 'vitest'

import {
  readDraftEdit,
  readDraftEnvelope,
  renderDraftEnvelope,
  renderOutline,
  selectionBlocks,
} from '../../../src/cli/draft/collab/document'

const paragraph = (text: string) => ({
  children: [
    { detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 },
  ],
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
})

const heading = (text: string) => ({
  ...paragraph(text),
  tag: 'h2',
  type: 'heading',
})

const content = JSON.stringify({
  root: {
    children: [heading('背景'), paragraph('价格是 $5/月，A&B 方案。'), paragraph('第二段')],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

const categories = [
  { id: 'c1', name: '技术', slug: 'tech' },
  { id: 'c2', name: '生活', slug: 'life' },
]

const seeded = () =>
  createContentDoc(
    {
      content,
      fields: {
        meta: { aiGen: [0, 8], paywall: { previewBlocks: 3 } },
        typeSpecificData: {
          categoryId: 'c1',
          copyright: true,
          slug: 'hello',
          summary: '摘要',
          tags: ['a', 'b'],
        },
      },
      title: '博客迁移记',
    },
    'init',
  )

describe('renderDraftEnvelope', () => {
  it('renders title, fields and blocks with ids', () => {
    const xml = renderDraftEnvelope(seeded(), categories)
    expect(xml).toMatch(/^<mxpost>/)
    expect(xml).toContain('<title>博客迁移记</title>')
    expect(xml).toContain('<slug>hello</slug>')
    expect(xml).toContain('<category>tech</category>')
    expect(xml).toContain('<tag>a</tag>')
    expect(xml).toContain('<ai-gen>[0,8]</ai-gen>')
    expect(xml).toContain('<paywall>{&quot;previewBlocks&quot;:3}</paywall>')
    expect(xml).toMatch(/<p id="[^"]+">价格是 \$5\/月，A&amp;B 方案。<\/p>/)
  })

  it('renders an empty tag list on one line', () => {
    const doc = createContentDoc(
      { content, fields: { meta: null, typeSpecificData: { tags: [] } }, title: 't' },
      'init',
    )
    const xml = renderDraftEnvelope(doc)
    expect(xml).toContain('    <tags></tags>')
    expect(readDraftEnvelope(xml, readDocContent(doc).fields).fields?.typeSpecificData).toEqual({ tags: [] })
  })

  it('has no whitespace-only lines', () => {
    const xml = renderDraftEnvelope(seeded(), categories)
    expect(xml.split('\n').filter((line) => !line.trim())).toEqual([])
  })
})

describe('readDraftEnvelope', () => {
  it('reads back exactly what it rendered', () => {
    const doc = seeded()
    const before = readDocContent(doc)
    const target = readDraftEnvelope(renderDraftEnvelope(doc, categories), before.fields, categories)
    expect(target.title).toBe(before.title)
    expect(target.fields).toEqual(before.fields)
    expect(JSON.parse(target.content).root.children).toHaveLength(3)
  })

  it('keeps multi-line code blocks byte for byte', () => {
    const code = 'line1\n\n  indented\n\tend'
    const doc = createContentDoc(
      {
        content: JSON.stringify({
          root: {
            children: [
              paragraph('a'),
              { code, language: 'ts', type: 'code-block', version: 1 },
              paragraph('b'),
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        }),
        title: 't',
      },
      'init',
    )
    const target = readDraftEnvelope(renderDraftEnvelope(doc), readDocContent(doc).fields)
    const block = JSON.parse(target.content).root.children.find(
      (child: { type: string }) => child.type === 'code-block',
    )
    expect(block.code).toBe(code)
  })

  it('changes only the title when <title> is edited', () => {
    const doc = seeded()
    const before = readDocContent(doc)
    const xml = renderDraftEnvelope(doc, categories).replace('博客迁移记', '新标题')
    const target = readDraftEnvelope(xml, before.fields, categories)
    expect(target.title).toBe('新标题')
    expect(target.fields).toEqual(before.fields)
  })

  it('maps edited tags, category slug and a removed key into fields', () => {
    const doc = seeded()
    const before = readDocContent(doc)
    const xml = renderDraftEnvelope(doc, categories)
      .replace('<tag>b</tag>', '<tag>b</tag>\n      <tag>c</tag>')
      .replace('<category>tech</category>', '<category>life</category>')
      .replace(/\s*<summary>摘要<\/summary>/, '')
    const target = readDraftEnvelope(xml, before.fields, categories)
    expect(target.fields?.typeSpecificData).toEqual({
      categoryId: 'c2',
      copyright: true,
      slug: 'hello',
      tags: ['a', 'b', 'c'],
    })
    expect(target.fields?.meta).toEqual(before.fields?.meta)
  })

  it('rejects an unknown category', () => {
    const doc = seeded()
    const xml = renderDraftEnvelope(doc, categories).replace('<category>tech</category>', '<category>nope</category>')
    expect(() => readDraftEnvelope(xml, readDocContent(doc).fields, categories)).toThrow(/unknown category "nope".*tech/)
  })

  it('never renders or reads a password', () => {
    const doc = seeded()
    const xml = renderDraftEnvelope(doc, categories).replace('<slug>', '<password>x</password>\n    <slug>')
    expect(readDraftEnvelope(xml, readDocContent(doc).fields, categories).fields?.typeSpecificData).not.toHaveProperty('password')
  })
})

describe('renderOutline and selectionBlocks', () => {
  it('lists headings with ids and block counts', () => {
    const xml = renderDraftEnvelope(seeded(), categories)
    const outline = renderOutline(xml)
    expect(outline).toMatch(/^# 博客迁移记/)
    expect(outline).toMatch(/## 背景 \[[^\]]+\] — 2 blocks/)
  })

  it('returns the selected blocks in document order', () => {
    const doc = seeded()
    const xml = renderDraftEnvelope(doc, categories)
    const ids = [...xml.matchAll(/<p id="([^"]+)"/g)].map((m) => m[1])
    const out = selectionBlocks(readDocContent(doc).content, [ids[1], ids[0]])
    expect(out.split('\n')).toHaveLength(2)
    expect(out.indexOf('价格是')).toBeLessThan(out.indexOf('第二段'))
  })
})

describe('selectionBlocks', () => {
  it('prints a multi-line block whole', () => {
    const code = 'line1\n\nline3'
    const doc = createContentDoc(
      {
        content: JSON.stringify({
          root: {
            children: [
              paragraph('前'),
              { code, language: 'ts', type: 'code-block', version: 1 },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        }),
        title: 't',
      },
      'init',
    )
    const content = readDocContent(doc).content
    const id = JSON.parse(content).root.children[1].$.blockId
    const out = selectionBlocks(content, [id])
    expect(out).toContain(code)
    expect(out).not.toContain('前')
  })
})

describe('readDraftEdit', () => {
  const styled = () => {
    const centered = {
      ...paragraph('居中段'),
      children: [
        {
          detail: 0,
          format: 0,
          mode: 'normal',
          style: 'color: red',
          text: '居中段',
          type: 'text',
          version: 1,
        },
      ],
      format: 'center',
      indent: 1,
    }
    return createContentDoc(
      {
        content: JSON.stringify({
          root: {
            children: [centered, paragraph('要改的段')],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        }),
        fields: {
          meta: null,
          typeSpecificData: { categoryId: 'gone', summary: 'sum ' },
        },
        title: '标题 ',
      },
      'init',
    )
  }

  const edit = (doc: ReturnType<typeof styled>, change: (xml: string) => string) => {
    const before = renderDraftEnvelope(doc, categories)
    return readDraftEdit(before, change(before), readDocContent(doc), categories)
  }

  it('keeps untouched blocks, title and fields exactly as the document has them', () => {
    const doc = styled()
    const current = readDocContent(doc)
    const target = edit(doc, (xml) => xml.replace('要改的段', '改好了'))
    const [kept, changed] = JSON.parse(target.content).root.children
    expect(kept).toEqual(JSON.parse(current.content).root.children[0])
    expect(changed.children[0].text).toBe('改好了')
    expect(target.title).toBe('标题 ')
    expect(target.fields).toEqual(current.fields)
  })

  it('leaves a category it cannot resolve alone when the edit does not touch it', () => {
    const doc = styled()
    const target = edit(doc, (xml) => xml.replace('要改的段', '改好了'))
    expect(target.fields?.typeSpecificData).toMatchObject({ categoryId: 'gone' })
  })

  it('writes only the field keys the edit changed', () => {
    const doc = styled()
    const target = edit(doc, (xml) =>
      xml.replace('<category>gone</category>', '<category>life</category>'),
    )
    expect(target.fields?.typeSpecificData).toEqual({
      categoryId: 'c2',
      summary: 'sum ',
    })
  })

  it('puts new disclosure and paywall keys under meta', () => {
    const doc = styled()
    const target = edit(doc, (xml) =>
      xml.replace(
        /(<title>.*<\/title>)/,
        '$1\n<ai-gen>[0,8]</ai-gen>\n<paywall>{"previewBlocks":1}</paywall>',
      ),
    )
    expect(target.fields?.meta).toEqual({
      aiGen: [0, 8],
      paywall: { previewBlocks: 1 },
    })
    expect(target.fields?.typeSpecificData).not.toHaveProperty('aiGen')
  })
})
