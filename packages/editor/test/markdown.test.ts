import { describe, expect, it } from 'vitest'

import { mxLexicalToMarkdown } from '../src'
import { UnknownEditorNodeError } from '../src/core/errors'

function textNode(text: string) {
  return {
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
  }
}

function paragraph(text: string) {
  return {
    children: [textNode(text)],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  }
}

function state(children: unknown[]) {
  return {
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root' as const,
      version: 1,
    },
  }
}

describe('mxLexicalToMarkdown', () => {
  it('projects standard lexical blocks through the headless serializer', () => {
    expect(mxLexicalToMarkdown(state([paragraph('Hello world')]))).toContain(
      'Hello world',
    )
  })

  it('splices mx map node LiteXML between standard lexical segments', () => {
    const markdown = mxLexicalToMarkdown(
      state([
        paragraph('Before'),
        {
          type: 'map',
          version: 1,
          title: 'Shanghai',
          pois: [{ title: 'The Bund' }, { title: "Jing'an Temple" }],
          track: { url: 'https://example.com/track.gpx' },
        },
        paragraph('After'),
      ]),
    )

    expect(markdown).toContain('Before')
    expect(markdown).toContain('<node type="map"')
    expect(markdown).toContain(
      'data="{&quot;title&quot;:&quot;Shanghai&quot;',
    )
    expect(markdown).toContain('&quot;Jing&apos;an Temple&quot;')
    expect(markdown).toContain(
      '&quot;url&quot;:&quot;https://example.com/track.gpx&quot;',
    )
    expect(markdown).toContain('After')
  })

  it('projects afilmory node as LiteXML without routing it through a text node', () => {
    const markdown = mxLexicalToMarkdown(
      state([
        {
          type: 'afilmory',
          version: 1,
          title: 'Trip',
          caption: 'Spring',
          baseUrl: 'https://photos.example.com',
          source: { kind: 'list', items: [{ id: '1' }, { id: '2' }] },
        },
      ]),
    )

    expect(markdown).toContain('<node type="afilmory"')
    expect(markdown).toContain(
      'data="{&quot;title&quot;:&quot;Trip&quot;,&quot;caption&quot;:&quot;Spring&quot;',
    )
    expect(markdown).toContain(
      '&quot;baseUrl&quot;:&quot;https://photos.example.com&quot;',
    )
    expect(markdown).toContain(
      '&quot;source&quot;:{&quot;kind&quot;:&quot;list&quot;',
    )
  })

  it('matches LiteXML fallback metadata handling for mx custom nodes', () => {
    const markdown = mxLexicalToMarkdown(
      state([
        {
          $: { blockId: 'block-1' },
          type: 'map',
          version: 1,
          title: 'A&B <C>',
        },
      ]),
    )

    expect(markdown).toBe(
      '<node type="map" id="block-1" data="{&quot;title&quot;:&quot;A&amp;B &lt;C&gt;&quot;}" />',
    )
  })

  it('projects stock snapshot node as LiteXML fallback', () => {
    const markdown = mxLexicalToMarkdown(
      state([
        {
          type: 'stock',
          version: 1,
          variant: 'snapshot',
          symbol: 'AAPL',
        },
      ]),
    )

    expect(markdown).toContain('<node type="stock"')
    expect(markdown).toContain('&quot;variant&quot;:&quot;snapshot&quot;')
    expect(markdown).toContain('&quot;symbol&quot;:&quot;AAPL&quot;')
  })

  it('projects stock kline node carrying range + ema as LiteXML fallback', () => {
    const markdown = mxLexicalToMarkdown(
      state([
        {
          type: 'stock',
          version: 1,
          variant: 'kline',
          symbol: 'TSLA',
          range: { interval: '1day', from: '2026-01-01', to: '2026-06-01' },
          ema: [12, 26],
        },
      ]),
    )

    expect(markdown).toContain('<node type="stock"')
    expect(markdown).toContain('&quot;variant&quot;:&quot;kline&quot;')
    expect(markdown).toContain('&quot;symbol&quot;:&quot;TSLA&quot;')
    expect(markdown).toContain('&quot;interval&quot;:&quot;1day&quot;')
    expect(markdown).toContain('&quot;ema&quot;:[12,26]')
  })

  it('throws on unknown node types', () => {
    expect(() =>
      mxLexicalToMarkdown(state([{ type: 'unknown-private', version: 1 }])),
    ).toThrow(UnknownEditorNodeError)
  })
})
