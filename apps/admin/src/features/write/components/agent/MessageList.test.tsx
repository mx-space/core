import { createAgentStore } from '@haklex/rich-agent-core'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MessageList } from './MessageList'

vi.mock('~/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@lobehub/streamdown', () => ({
  Streamdown: ({ content }: { content: string }) => content,
}))

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

function render(store = createAgentStore()) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  const draw = (isHydrating = false) =>
    act(() => {
      root!.render(
        createElement(MessageList, {
          isHydrating,
          onAcceptBatch: () => {},
          onReapplyBatch: () => {},
          onReapplyToolGroup: () => {},
          onRejectBatch: () => {},
          store,
        }),
      )
    })
  draw()
  return { draw, store }
}

const entering = () => container!.querySelectorAll('[data-agent-enter]')

describe('MessageList', () => {
  it('animates a message sent after the list was shown', () => {
    const { store } = render()

    act(() => store.getState().addBubble({ content: 'hi', type: 'user' }))

    expect(entering()).toHaveLength(1)
  })

  it('does not animate messages restored from history', () => {
    const store = createAgentStore()
    const { draw } = render(store)
    draw(true)

    act(() =>
      store.setState({
        bubbles: [
          { content: 'old question', type: 'user' },
          { content: 'old answer', streaming: false, type: 'assistant' },
        ],
      }),
    )
    draw(false)

    expect(entering()).toHaveLength(0)
  })

  it('animates the first message of a new conversation', () => {
    const store = createAgentStore([{ content: 'first chat', type: 'user' }])
    render(store)

    act(() => store.setState({ bubbles: [] }))
    act(() =>
      store.getState().addBubble({ content: 'second chat', type: 'user' }),
    )

    expect(entering()).toHaveLength(1)
    expect(entering()[0].textContent).toContain('second chat')
  })

  it('does not animate a conversation switched in without hydrating', () => {
    const { store } = render()
    act(() =>
      store.getState().addBubble({ content: 'first chat', type: 'user' }),
    )

    act(() =>
      store.setState({
        bubbles: [
          { content: 'other chat', type: 'user' },
          { content: 'reply', streaming: false, type: 'assistant' },
        ],
      }),
    )

    expect(entering()).toHaveLength(0)
  })
})
