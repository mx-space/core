import { describe, expect, it } from 'vitest'

import {
  extractDocumentContext,
  extractFileUrlsFromContent,
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
    const extracted = extractFileUrlsFromContent({
      text: '![cover](https://img.example/cover.png)',
      contentFormat: 'markdown',
      meta: {
        cover: ' https://img.example/cover.png ',
      },
    })

    expect(extracted).toEqual(['https://img.example/cover.png'])
  })

  it('should collect lexical image sources and append cover from serialized meta', () => {
    const extracted = extractFileUrlsFromContent({
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

  it('should collect file attachment sources from lexical content', () => {
    const extracted = extractFileUrlsFromContent({
      text: '',
      contentFormat: 'lexical',
      content: JSON.stringify({
        root: {
          type: 'root',
          version: 1,
          children: [
            {
              type: 'file',
              version: 1,
              src: 'https://cdn.example/file/report.pdf',
              name: 'report.pdf',
              ext: 'pdf',
              mimeType: 'application/pdf',
              size: 1024,
            },
            paragraph({
              type: 'file',
              version: 1,
              src: 'https://cdn.example/file/notes.md',
              name: 'notes.md',
              display: 'inline',
            }),
          ],
        },
      }),
    })

    expect(extracted).toEqual([
      'https://cdn.example/file/report.pdf',
      'https://cdn.example/file/notes.md',
    ])
  })

  it('should fall back to cover image when lexical content is invalid', () => {
    const extracted = extractFileUrlsFromContent({
      text: '',
      contentFormat: 'lexical',
      content: '{invalid json',
      meta: {
        cover: 'https://img.example/cover.png',
      },
    })

    expect(extracted).toEqual(['https://img.example/cover.png'])
  })

  it('should collect Markdown attachments and HTML media files', () => {
    const extracted = extractFileUrlsFromContent({
      text: [
        '[Download guide](https://cdn.example/guide.pdf)',
        '<video src="https://cdn.example/demo.mp4" poster="https://cdn.example/poster.webp"></video>',
      ].join('\n'),
      contentFormat: 'markdown',
    })

    expect(extracted).toEqual([
      'https://cdn.example/guide.pdf',
      'https://cdn.example/demo.mp4',
      'https://cdn.example/poster.webp',
    ])
  })

  it('should collect file URLs from rich media and nested lexical states', () => {
    const extracted = extractFileUrlsFromContent({
      text: '',
      contentFormat: 'lexical',
      images: [{ src: 'https://cdn.example/legacy-image.png' }],
      meta: {
        cover: 'https://cdn.example/cover.png',
        customAsset: 'https://cdn.example/custom.zip',
      },
      content: JSON.stringify({
        root: {
          type: 'root',
          version: 1,
          children: [
            {
              type: 'video',
              version: 1,
              src: 'https://cdn.example/demo.mp4',
              poster: 'https://cdn.example/video-cover.webp',
            },
            {
              type: 'map',
              version: 1,
              track: { url: 'https://cdn.example/route.gpx.json' },
            },
            {
              type: 'excalidraw',
              version: 1,
              snapshot:
                'https://cdn.example/base.excalidraw.json\n{"delta":true}',
            },
            {
              type: 'banner',
              version: 1,
              content: {
                root: {
                  type: 'root',
                  version: 1,
                  children: [
                    {
                      type: 'image',
                      version: 1,
                      src: 'https://cdn.example/nested.png',
                    },
                  ],
                },
              },
            },
          ],
        },
      }),
    })

    expect(extracted).toEqual([
      'https://cdn.example/demo.mp4',
      'https://cdn.example/video-cover.webp',
      'https://cdn.example/route.gpx.json',
      'https://cdn.example/base.excalidraw.json',
      'https://cdn.example/nested.png',
      'https://cdn.example/legacy-image.png',
      'https://cdn.example/cover.png',
      'https://cdn.example/custom.zip',
    ])
  })
})
