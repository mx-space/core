import type { ChatBubble } from '@haklex/rich-agent-core'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentMessageItem } from './messages'

vi.mock('~/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}(${Object.values(values).join(',')})` : key,
  }),
}))

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

function render(bubble: ChatBubble) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      createElement(AgentMessageItem, {
        actionsLocked: false,
        bubble,
        getBatch: () => undefined,
        onAcceptBatch: () => {},
        onReapplyBatch: () => {},
        onReapplyToolGroup: () => {},
        onRejectBatch: () => {},
      }),
    )
  })
  return container
}

describe('AgentMessageItem assistant', () => {
  it('shows the turn usage under the reply', () => {
    const view = render({
      content: 'Done',
      streaming: false,
      type: 'assistant',
      usage: {
        cacheRead: 9702,
        cacheWrite: 0,
        calls: 4,
        cost: 0.0031,
        input: 2729,
        output: 860,
      },
    } as ChatBubble)

    const meta = view.querySelector('[data-agent-usage]')
    expect(meta?.textContent).toContain('write.agent.usage.input(12.4k)')
    expect(meta?.textContent).toContain('write.agent.usage.output(860)')
    expect(meta?.textContent).toContain('write.agent.usage.cacheHit(78%)')
    expect(meta?.textContent).toContain('$0.0031')
  })

  it('renders no usage line for a reply without usage', () => {
    const view = render({ content: 'Hi', streaming: false, type: 'assistant' })

    expect(view.querySelector('[data-agent-usage]')).toBeNull()
    expect(view.querySelector('.agent-md')).not.toBeNull()
  })
})
