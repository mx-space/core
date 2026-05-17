import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  coerceMeta,
  flagToTag,
  parseEnvelope,
  tagToFlag,
} from '../../src/core/envelope'

const fixture = (name: string) =>
  readFileSync(path.resolve(__dirname, '../fixtures', name), 'utf8')

describe('envelope parser', () => {
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

  it('throws with line on malformed XML', () => {
    const xml = fixture('post-bad.xml')
    expect(() => parseEnvelope(xml, 'post')).toThrow()
  })

  it('rejects wrong root tag', () => {
    expect(() => parseEnvelope('<wrong></wrong>', 'post')).toThrow()
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
})
