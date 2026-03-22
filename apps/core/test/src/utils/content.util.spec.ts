import { describe, expect, it } from 'vitest'

import { extractTextFromContent } from '~/utils/content.util'

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
  it('should extract text from builtin and headless lexical nodes', () => {
    const content = JSON.stringify({
      root: {
        type: 'root',
        version: 1,
        children: [
          {
            type: 'heading',
            tag: 'h1',
            version: 1,
            children: [textNode('标题节点')],
          },
          {
            type: 'quote',
            version: 1,
            children: [textNode('引用节点')],
          },
          {
            type: 'list',
            listType: 'bullet',
            start: 1,
            version: 1,
            children: [
              {
                type: 'listitem',
                version: 1,
                children: [paragraph(textNode('列表节点'))],
              },
            ],
          },
          paragraph({
            type: 'link',
            url: 'https://example.com',
            version: 1,
            children: [textNode('链接节点')],
          }),
          {
            type: 'table',
            version: 1,
            children: [
              {
                type: 'tablerow',
                version: 1,
                children: [
                  {
                    type: 'tablecell',
                    headerState: 0,
                    colSpan: 1,
                    version: 1,
                    children: [paragraph(textNode('表格节点'))],
                  },
                ],
              },
            ],
          },
          {
            type: 'code',
            version: 1,
            children: [textNode('内建代码节点')],
          },
          { type: 'horizontalrule', version: 1 },
          paragraph({
            type: 'spoiler',
            version: 1,
            children: [textNode('剧透节点')],
          }),
          paragraph({
            type: 'ruby',
            version: 1,
            reading: 'zhuyin',
            children: [textNode('注音节点')],
          }),
          {
            type: 'details',
            version: 1,
            summary: '详情摘要',
            open: true,
            children: [paragraph(textNode('详情正文'))],
          },
          {
            type: 'image',
            version: 1,
            src: 'https://cdn.example.com/image.png',
            altText: '图片说明',
            caption: '图片标题',
          },
          {
            type: 'video',
            version: 1,
            src: 'https://cdn.example.com/video.mp4',
            poster: 'https://cdn.example.com/poster.png',
          },
          {
            type: 'link-card',
            version: 1,
            url: 'https://example.com/card',
            title: '卡片标题',
            description: '卡片描述',
          },
          {
            type: 'katex-inline',
            version: 1,
            equation: 'E=mc^2',
          },
          {
            type: 'katex-block',
            version: 1,
            equation: 'a^2+b^2=c^2',
          },
          {
            type: 'mermaid',
            version: 1,
            diagram: 'graph TD; A-->B;',
          },
          {
            type: 'mention',
            version: 1,
            platform: 'github',
            handle: 'innei',
            displayName: 'Innei',
          },
          {
            type: 'code-block',
            version: 1,
            code: 'const rich = true',
            language: 'ts',
          },
          {
            type: 'footnote',
            version: 1,
            identifier: 'fn-1',
          },
          {
            type: 'footnote-section',
            version: 1,
            definitions: {
              'fn-1': '脚注内容',
            },
          },
          {
            type: 'embed',
            version: 1,
            url: 'https://example.com/embed',
            source: 'youtube',
          },
          {
            type: 'code-snippet',
            version: 1,
            files: [
              {
                filename: 'index.ts',
                content: 'export const snippet = true',
                language: 'ts',
              },
            ],
          },
          {
            type: 'gallery',
            version: 1,
            layout: 'grid',
            images: [
              {
                src: 'https://cdn.example.com/gallery-1.png',
                alt: '画廊图片',
                caption: '画廊说明',
              },
            ],
          },
          {
            type: 'excalidraw',
            version: 1,
            snapshot: '{"elements":[{"text":"白板节点"}]}',
          },
          {
            type: 'banner',
            version: 1,
            bannerType: 'note',
            content: nestedState('横幅内容'),
          },
          {
            type: 'alert-quote',
            version: 1,
            alertType: 'warning',
            content: nestedState('警告内容'),
          },
          {
            type: 'nested-doc',
            version: 1,
            content: nestedState('嵌套文档内容'),
          },
          {
            type: 'grid-container',
            version: 1,
            cols: 2,
            gap: '16px',
            cells: [nestedState('网格一'), nestedState('网格二')],
          },
          paragraph({
            type: 'tag',
            version: 1,
            text: '标签节点',
          }),
          paragraph({
            type: 'comment',
            version: 1,
            text: '评论节点',
          }),
        ],
      },
    })

    const extracted = extractTextFromContent({
      text: '',
      contentFormat: 'lexical',
      content,
    })

    for (const token of [
      '标题节点',
      '引用节点',
      '列表节点',
      '链接节点',
      '表格节点',
      '内建代码节点',
      '剧透节点',
      '注音节点',
      '详情摘要',
      '详情正文',
      '图片说明',
      '图片标题',
      '卡片标题',
      '卡片描述',
      'E=mc^2',
      'a^2+b^2=c^2',
      'graph TD; A-->B;',
      'innei',
      'Innei',
      'const rich = true',
      '脚注内容',
      'index.ts',
      'export const snippet = true',
      '画廊图片',
      '画廊说明',
      '白板节点',
      '横幅内容',
      '警告内容',
      '嵌套文档内容',
      '网格一',
      '网格二',
      '标签节点',
      '评论节点',
    ]) {
      expect(extracted).toContain(token)
    }

    expect(extracted).not.toContain('https://example.com/card')
    expect(extracted).not.toContain('https://cdn.example.com/video.mp4')
  })
})
