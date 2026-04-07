import { describe, expect, it } from 'vitest'

import {
  extractDocumentContext,
  extractImagesFromContent,
  extractTextFromContent,
} from '~/utils/content.util'

const textNode = (text: string) => ({
  type: 'text',
  version: 1,
  text,
})

const paragraph = (...children: any[]) => ({
  type: 'paragraph',
  version: 1,
  children,
})

const nestedState = (text: string) => ({
  root: {
    type: 'root',
    version: 1,
    children: [paragraph(textNode(text))],
  },
})

describe('content.util', () => {
  it('should reuse lexical translation context extraction for lexical text', () => {
    const rootChildren = [
      {
        type: 'heading',
        tag: 'h1',
        version: 1,
        children: [textNode('标题节点')],
      },
      {
        type: 'details',
        version: 1,
        summary: '详情摘要',
        children: [paragraph(textNode('详情正文'))],
      },
      {
        type: 'mention',
        version: 1,
        handle: 'innei',
        displayName: 'Innei',
      },
      {
        type: 'link-card',
        version: 1,
        title: '卡片标题',
        description: '卡片描述',
      },
      {
        type: 'banner',
        version: 1,
        content: nestedState('横幅内容'),
      },
      {
        type: 'excalidraw',
        version: 1,
        snapshot: JSON.stringify({
          store: {
            shape1: {
              props: {
                text: '白板节点',
              },
            },
          },
        }),
      },
      {
        type: 'code-block',
        version: 1,
        code: 'const rich = true',
      },
    ]
    const content = JSON.stringify({
      root: {
        type: 'root',
        version: 1,
        children: rootChildren,
      },
    })

    const extracted = extractTextFromContent({
      text: '',
      contentFormat: 'lexical',
      content,
    })
    const expected = extractDocumentContext(rootChildren)
      .replaceAll(/\s+/g, ' ')
      .trim()

    expect(extracted).toBe(expected)
    expect(extracted).toContain('标题节点')
    expect(extracted).toContain('详情正文')
    expect(extracted).toContain('横幅内容')
    expect(extracted).toContain('白板节点')
    expect(extracted).not.toContain('详情摘要')
    expect(extracted).not.toContain('innei')
    expect(extracted).not.toContain('卡片标题')
    expect(extracted).not.toContain('const rich = true')
  })

  it('should include cover image from markdown meta and dedupe repeated urls', () => {
    const extracted = extractImagesFromContent({
      text: '![cover](https://img.example/cover.png)',
      contentFormat: 'markdown',
      meta: {
        cover: ' https://img.example/cover.png ',
      },
    })

    expect(extracted).toEqual(['https://img.example/cover.png'])
  })

  it('should collect lexical image sources and append cover from serialized meta', () => {
    const extracted = extractImagesFromContent({
      text: '',
      contentFormat: 'lexical',
      meta: JSON.stringify({
        cover: 'https://img.example/cover.png',
      }),
      content: JSON.stringify({
        root: {
          type: 'root',
          version: 1,
          children: [
            {
              type: 'image',
              version: 1,
              src: 'https://img.example/inline.png',
            },
            {
              type: 'gallery',
              version: 1,
              images: [
                { src: 'https://img.example/gallery-a.png' },
                { src: 'https://img.example/gallery-b.png' },
              ],
            },
            {
              type: 'link-card',
              version: 1,
              image: 'https://img.example/card.png',
            },
          ],
        },
      }),
    })

    expect(extracted).toEqual([
      'https://img.example/inline.png',
      'https://img.example/gallery-a.png',
      'https://img.example/gallery-b.png',
      'https://img.example/card.png',
      'https://img.example/cover.png',
    ])
  })

  it('should fall back to cover image when lexical content is invalid', () => {
    const extracted = extractImagesFromContent({
      text: '',
      contentFormat: 'lexical',
      content: '{invalid json',
      meta: {
        cover: 'https://img.example/cover.png',
      },
    })

    expect(extracted).toEqual(['https://img.example/cover.png'])
  })
})
