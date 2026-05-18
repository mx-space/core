import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  coerceMeta,
  flagToTag,
  listUnknownMetaKeys,
  parseEnvelope,
  tagToFlag,
} from '../../src/domain/envelope'

const fixture = (name: string) =>
  readFileSync(path.resolve(__dirname, '../fixtures', name), 'utf8')

describe('envelope parser (src)', () => {
  it('parses mxpost envelope with meta and content', () => {
    const xml = fixture('post.xml')
    const parsed = parseEnvelope(xml, 'post')
    expect(parsed.kind).toBe('post')
    expect(parsed.meta.title).toBe('题名')
    expect(parsed.meta.slug).toBe('my-post')
    expect(parsed.meta.category).toBe('tech')
    expect(parsed.meta.state).toBe('publish')
    expect(parsed.meta.summary).toBe('摘要')
    expect(parsed.meta.copyright).toBe('true')
    expect(parsed.meta.pin).toBe('2026-05-14')
    expect(parsed.meta.tags).toEqual(['foo', 'bar'])
    expect(parsed.contentXml).toContain('<p>正文一</p>')
    expect(parsed.contentXml).toContain('<h2>章节</h2>')
  })

  it('coerces meta types', () => {
    const xml = fixture('post.xml')
    const parsed = parseEnvelope(xml, 'post')
    const coerced = coerceMeta(parsed.meta)
    expect(coerced.title).toBe('题名')
    expect(coerced.copyright).toBe(true)
    expect(coerced.state).toBe('publish')
    expect(coerced.tags).toEqual(['foo', 'bar'])
  })

  it('parses mxnote envelope', () => {
    const xml = fixture('note.xml')
    const parsed = parseEnvelope(xml, 'note')
    expect(parsed.kind).toBe('note')
    expect(parsed.meta.title).toBe('note title')
    expect(parsed.meta.topic).toBe('life')
    expect(parsed.meta.bookmark).toBe('false')
    const coerced = coerceMeta(parsed.meta)
    expect(coerced.bookmark).toBe(false)
    expect(coerced.publicAt).toBe('2026-05-14T10:00:00Z')
    expect(parsed.contentXml).toContain('<p>note body</p>')
  })

  it('preserves content tag attributes', () => {
    const xml = `<mxpost>
  <meta>
    <title>t</title>
  </meta>
  <content>
<p id="p1">See <a href="https://example.com?a=1&amp;b=2" target="_blank">example</a></p>
<embed id="e1" url="https://x.com/innei/status/1" source="tweet" />
  </content>
</mxpost>`
    const parsed = parseEnvelope(xml, 'post')

    expect(parsed.contentXml).toContain(
      '<a href="https://example.com?a=1&amp;b=2" target="_blank">',
    )
    expect(parsed.contentXml).toContain(
      '<embed id="e1" url="https://x.com/innei/status/1" source="tweet" />',
    )
  })

  it('records line numbers for meta entries', () => {
    const xml = fixture('post.xml')
    const parsed = parseEnvelope(xml, 'post')
    expect(parsed.sourceMap['meta.title']).toBe(3)
    expect(parsed.sourceMap['meta.slug']).toBe(4)
    expect(parsed.sourceMap.content).toBeGreaterThan(0)
  })

  it('throws ValidationXml on malformed XML', () => {
    const xml = fixture('post-bad.xml')
    expect(() => parseEnvelope(xml, 'post')).toThrowError(
      expect.objectContaining({ _tag: 'ValidationXml' }),
    )
  })

  it('rejects wrong root tag', () => {
    expect(() => parseEnvelope('<wrong></wrong>', 'post')).toThrowError(
      expect.objectContaining({ _tag: 'ValidationXml' }),
    )
  })

  it('maps kebab-case flag to camelCase tag', () => {
    expect(flagToTag('--pin-order')).toBe('pinOrder')
    expect(flagToTag('--public-at')).toBe('publicAt')
    expect(tagToFlag('pinOrder')).toBe('--pin-order')
    expect(tagToFlag('publicAt')).toBe('--public-at')
  })

  it('reads pinOrder via meta and coerces to number', () => {
    const xml = `<mxpost><meta><title>t</title><pinOrder>3</pinOrder></meta><content/></mxpost>`
    const parsed = parseEnvelope(xml, 'post')
    expect(parsed.meta.pinOrder).toBe('3')
    expect(coerceMeta(parsed.meta).pinOrder).toBe(3)
  })

  it('coerces all supported note/page/post meta fields', () => {
    const coerced = coerceMeta({
      category: 'tech',
      topic: 'life',
      summary: 's',
      state: 'draft',
      copyright: 'false',
      pin: '2026-01-01',
      pinOrder: 'not-a-number',
      related: ['1', '2'],
      tags: ['a'],
      mood: 'calm',
      weather: 'sunny',
      publicAt: '2026-01-01T00:00:00Z',
      password: 'secret',
      bookmark: 'true',
      location: 'Earth',
      subtitle: 'Sub',
      order: '4',
      format: 'markdown',
    })
    expect(coerced).toMatchObject({
      category: 'tech',
      topic: 'life',
      summary: 's',
      state: 'draft',
      copyright: false,
      pin: '2026-01-01',
      related: ['1', '2'],
      tags: ['a'],
      mood: 'calm',
      weather: 'sunny',
      publicAt: '2026-01-01T00:00:00Z',
      password: 'secret',
      bookmark: true,
      location: 'Earth',
      subtitle: 'Sub',
      order: 4,
      format: 'markdown',
    })
    expect(coerced.pinOrder).toBeUndefined()
  })

  it('reports unknown meta keys', () => {
    expect(
      listUnknownMetaKeys({ title: 't', extra: 'x', another: 'y' }, ['title']),
    ).toEqual(['extra', 'another'])
  })

  it('handles self-closing meta/content and CDATA content', () => {
    const parsed = parseEnvelope(
      `<mxpost><meta><subtitle/><related><id>1</id><id>2</id></related></meta><content><![CDATA[<p>raw</p>]]></content></mxpost>`,
      'post',
    )
    expect(parsed.meta.subtitle).toBe('')
    expect(parsed.meta.related).toEqual(['1', '2'])
    expect(parsed.contentXml).toBe('<![CDATA[<p>raw</p>]]>')

    const empty = parseEnvelope(
      '<mxpost><meta><title>t</title></meta><content/></mxpost>',
      'post',
    )
    expect(empty.contentXml).toBe('')
  })

  it('throws ValidationXml for malformed comments, CDATA, tags, root content, and unterminated sections', () => {
    const invalid = [
      '<mxpost><!-- broken<meta></meta></mxpost>',
      '<mxpost><![CDATA[ broken</mxpost>',
      '<mxpost><meta></meta',
      '<mxpost><meta></meta><extra/></mxpost>',
      '<mxpost><meta><title>t</meta></mxpost>',
      '<mxpost><meta></meta>',
    ]
    for (const xml of invalid) {
      expect(() => parseEnvelope(xml, 'post')).toThrowError(
        expect.objectContaining({ _tag: 'ValidationXml' }),
      )
    }
  })
})
