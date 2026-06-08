import { describe, expect, it } from 'vitest'

import {
  deserializeMxLitexmlToLexical,
  serializeMxLexicalToLitexml,
  stripMxLitexmlDocWrapper,
} from '../src'

describe('mx LiteXML conversion', () => {
  it('round-trips mx map nodes through LiteXML fallback nodes', () => {
    const state = deserializeMxLitexmlToLexical(
      '<doc><node type="map" id="map-1" data="{&quot;title&quot;:&quot;Shanghai&quot;,&quot;pois&quot;:[{&quot;title&quot;:&quot;Bund&quot;}]}" /></doc>',
    )

    const mapNode = state.root.children[0] as any
    expect(mapNode.type).toBe('map')
    expect(mapNode.$?.blockId).toBe('map-1')
    expect(mapNode.title).toBe('Shanghai')
    expect(mapNode.pois[0].title).toBe('Bund')

    const xml = stripMxLitexmlDocWrapper(
      serializeMxLexicalToLitexml(state, { compact: false }),
    ).trim()
    expect(xml).toContain('<node type="map" id="map-1"')
    expect(xml).toContain('&quot;title&quot;:&quot;Shanghai&quot;')
    expect(xml).toContain('&quot;title&quot;:&quot;Bund&quot;')
  })

  it('serializes mx afilmory nodes through the same XML contract', () => {
    const xml = stripMxLitexmlDocWrapper(
      serializeMxLexicalToLitexml(
        {
          root: {
            children: [
              {
                baseUrl: 'https://photos.example.com',
                layout: 'grid',
                source: { kind: 'list', items: [{ h: 768, id: '1', w: 1024 }] },
                title: 'Trip',
                type: 'afilmory',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        } as any,
        { compact: false },
      ),
    ).trim()

    expect(xml).toContain('<node type="afilmory"')
    expect(xml).toContain('&quot;baseUrl&quot;:&quot;https://photos.example.com&quot;')
    expect(xml).toContain('&quot;source&quot;:{&quot;kind&quot;:&quot;list&quot;')
  })
})
