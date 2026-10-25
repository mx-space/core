import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
} from 'lexical'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { RemotePresence } from '../../crdt/collab-presence'
import { RemoteCarets } from './RemoteCarets'

const sourceOf = (peers: RemotePresence[]) => ({
  get: () => peers,
  subscribe: () => () => undefined,
})

let host: HTMLDivElement
let root: Root

const peer = (focus: RemotePresence['focus']): RemotePresence => ({
  anchor: focus,
  color: '#e5484d',
  focus,
  key: 'c1',
  user: { avatar: null, id: 'owner', name: 'Ann' },
})

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
})

const mountEditor = () => {
  const frame = document.createElement('div')
  const editable = document.createElement('div')
  editable.contentEditable = 'true'
  frame.append(editable)
  document.body.append(frame)
  const editor = createEditor({
    onError: (error) => {
      throw error
    },
  })
  editor.setRootElement(editable)
  let key = ''
  editor.update(
    () => {
      const text = $createTextNode('hello')
      $getRoot().append($createParagraphNode().append(text))
      key = text.getKey()
    },
    { discrete: true },
  )
  return { editor, frame, key }
}

describe('RemoteCarets', () => {
  it('draws a named caret for a member whose position resolves', () => {
    const { editor, frame, key } = mountEditor()

    act(() => {
      root.render(
        createElement(RemoteCarets, {
          editor,
          peers: sourceOf([peer({ id: '1@1', offset: 2 })]),
          resolveCaret: () => ({ key, offset: 2 }),
        }),
      )
    })

    const caret = frame.querySelector('[data-remote-caret]')
    expect(caret).not.toBeNull()
    expect(caret!.textContent).toBe('Ann')
  })

  it('draws nothing for a member without a resolvable caret', () => {
    const { editor, frame } = mountEditor()

    act(() => {
      root.render(
        createElement(RemoteCarets, {
          editor,
          peers: sourceOf([peer({ id: '9@9', offset: 0 }), peer(null)]),
          resolveCaret: () => null,
        }),
      )
    })

    expect(frame.querySelector('[data-remote-caret]')).toBeNull()
  })
})
