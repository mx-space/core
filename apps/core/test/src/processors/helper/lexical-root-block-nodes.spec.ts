import { describe, expect, it } from 'vitest'

import {
  BLOCK_ID_STATE_KEY,
  NODE_STATE_KEY,
} from '~/constants/lexical.constant'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { md5 } from '~/utils/tool.util'

function withBlockId(node: Record<string, any>, blockId: string) {
  return { ...node, [NODE_STATE_KEY]: { [BLOCK_ID_STATE_KEY]: blockId } }
}

function textNode(text: string) {
  return { type: 'text', text }
}

const CONTENT = JSON.stringify({
  root: {
    children: [
      withBlockId(
        { type: 'paragraph', children: [textNode('hello')] },
        'blk-a',
      ),
      withBlockId({ type: 'code', code: 'const a = 1' }, 'blk-b'),
    ],
  },
})

describe('LexicalService.extractRootBlockNodes', () => {
  it('returns the underlying node alongside id and type', () => {
    const service = new LexicalService()
    const nodes = service.extractRootBlockNodes(CONTENT)

    expect(nodes).toHaveLength(2)
    expect(nodes[0].id).toBe('blk-a')
    expect(nodes[0].type).toBe('paragraph')
    expect(nodes[0].node.children[0].text).toBe('hello')
    expect(nodes[1].index).toBe(1)
  })

  it('produces byte-identical extractRootBlocks output for a mixed-type document', () => {
    const service = new LexicalService()
    const state = JSON.stringify({
      root: {
        children: [
          withBlockId(
            { type: 'paragraph', children: [textNode('Hello world')] },
            'para0001',
          ),
          withBlockId(
            { type: 'heading', tag: 'h1', children: [textNode('Title')] },
            'head0001',
          ),
          withBlockId(
            {
              type: 'list',
              listType: 'bullet',
              children: [
                { type: 'listitem', children: [textNode('first')] },
                { type: 'listitem', children: [textNode('second')] },
              ],
            },
            'list0001',
          ),
          withBlockId({ type: 'code', code: 'const a = 1' }, 'code0001'),
          withBlockId(
            { type: 'mermaid', diagram: 'graph TD\n  A-->B' },
            'merm0001',
          ),
          withBlockId(
            {
              type: 'banner',
              bannerType: 'warning',
              content: {
                root: {
                  children: [
                    { type: 'paragraph', children: [textNode('Danger ahead')] },
                  ],
                },
              },
            },
            'bann0001',
          ),
        ],
      },
    })

    const blocks = service.extractRootBlocks(state)

    expect(
      blocks.map(({ id, type, text, index }) => ({ id, type, text, index })),
    ).toEqual([
      { id: 'para0001', type: 'paragraph', text: 'Hello world', index: 0 },
      { id: 'head0001', type: 'heading', text: 'Title', index: 1 },
      { id: 'list0001', type: 'list', text: 'firstsecond', index: 2 },
      { id: 'code0001', type: 'code', text: 'const a = 1', index: 3 },
      {
        id: 'merm0001',
        type: 'mermaid',
        text: 'graph TD\n  A-->B',
        index: 4,
      },
      { id: 'bann0001', type: 'banner', text: 'Danger ahead', index: 5 },
    ])

    expect(blocks.map((b) => b.fingerprint)).toEqual([
      md5('paragraph:Hello world'),
      md5('heading:Title'),
      md5('list:firstsecond'),
      md5('code:const a = 1'),
      md5('mermaid:graph TD A-->B'),
      md5('banner:Danger ahead'),
    ])
  })
})
