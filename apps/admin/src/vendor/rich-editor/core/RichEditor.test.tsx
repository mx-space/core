import type { LexicalEditor, SerializedEditorState } from 'lexical'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RichEditor } from './RichEditor'

// Whiteboard pulls roughjs through an extensionless deep import that Node's
// ESM resolver rejects; it is irrelevant to which nodes the editor registers.
// vi.mock factories are hoisted above static imports, hence `await import`.
const { whiteboardStub } = vi.hoisted(() => ({
  whiteboardStub: async () => {
    const { DecoratorNode } = await import('lexical')
    class WhiteboardStubNode extends DecoratorNode<null> {
      static getType() {
        return 'excalidraw'
      }
      static clone(node: WhiteboardStubNode) {
        return new WhiteboardStubNode(node.__key)
      }
      createDOM() {
        return document.createElement('div')
      }
      updateDOM() {
        return false
      }
      decorate() {
        return null
      }
    }
    return WhiteboardStubNode
  },
}))
vi.mock('@haklex/rich-ext-whiteboard', async () => ({
  WhiteboardEditNode: await whiteboardStub(),
  WhiteboardPlugin: () => null,
}))
vi.mock('@haklex/rich-ext-whiteboard/static', async () => ({
  WhiteboardNode: await whiteboardStub(),
}))

const poll = {
  closeAt: null,
  mode: 'single',
  options: [
    { id: 'o1', label: '一周内' },
    { id: 'o2', label: '更久' },
  ],
  pollId: 'p_regression',
  question: '有多久没有手写过代码了？',
  showResults: 'after-vote',
  type: 'poll',
  version: 1,
}

const pollDocument = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Before the poll',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
      poll,
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
} as unknown as SerializedEditorState

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('RichEditor', () => {
  it('keeps poll blocks when loading a document', async () => {
    let editor: LexicalEditor | null = null
    await act(async () => {
      root.render(
        createElement(RichEditor, {
          initialValue: pollDocument,
          onEditorReady: (ready: LexicalEditor | null) => {
            editor = ready
          },
        }),
      )
    })

    expect(editor).not.toBeNull()
    const children = editor!.getEditorState().toJSON().root.children
    expect(children.find((node) => node.type === 'poll')).toMatchObject({
      options: poll.options,
      pollId: poll.pollId,
      question: poll.question,
    })
  })
})
