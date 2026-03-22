import { describe, expect, it } from 'vitest'

import {
  extractDocumentContext,
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
})
