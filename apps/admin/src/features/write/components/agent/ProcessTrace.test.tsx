import type { ToolCallGroupItem } from '@haklex/rich-agent-core'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProcessBubble } from './agent-process'
import { ProcessTrace } from './ProcessTrace'

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

const item = (
  status: ToolCallGroupItem['status'],
  extra: Partial<ToolCallGroupItem> = {},
): ToolCallGroupItem =>
  ({
    description: '/embeds/5rIpK5hR.excalidraw',
    id: crypto.randomUUID(),
    params: { path: '/embeds/5rIpK5hR.excalidraw' },
    status,
    toolName: 'edit',
    ...extra,
  }) as ToolCallGroupItem

function render(bubbles: ProcessBubble[], live = false) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      createElement(ProcessTrace, {
        bubbles,
        live,
        onReapply: () => {},
        reapplyDisabled: false,
      }),
    )
  })
  return container
}

const steps = (view: HTMLElement) =>
  view.querySelectorAll('[data-process-step]')

describe('ProcessTrace', () => {
  const done: ProcessBubble[] = [
    { content: 'read embeds first', type: 'thinking' },
    {
      id: 'g1',
      items: [item('completed'), item('completed')],
      type: 'tool_call_group',
    },
  ]

  it('folds a finished process into one summary row', () => {
    const view = render(done)

    expect(view.querySelector('[data-process-summary]')?.textContent).toContain(
      'write.agent.process.tools(2)',
    )
    expect(steps(view)).toHaveLength(0)
  })

  it('expands the folded process when the summary is clicked', () => {
    const view = render(done)

    act(() =>
      view.querySelector<HTMLButtonElement>('[data-process-summary]')!.click(),
    )

    expect(steps(view)).toHaveLength(3)
  })

  it('shows every step while the turn is live', () => {
    const view = render(
      [
        { content: 'plan', type: 'thinking' },
        { content: 'next', isStreaming: true, type: 'thinking' },
      ],
      true,
    )

    expect(view.querySelector('[data-process-summary]')).toBeNull()
    expect(steps(view)).toHaveLength(2)
    expect(view.textContent).toContain('write.agent.process.thinking')
  })

  it('keeps a process with a failed tool expanded and shows the error', () => {
    const view = render([
      {
        id: 'g1',
        items: [item('error', { error: 'find text not matched' })],
        type: 'tool_call_group',
      },
    ])

    expect(view.querySelector('[data-process-summary]')?.textContent).toContain(
      'write.agent.process.failed(1)',
    )
    expect(steps(view)).toHaveLength(1)
    expect(view.textContent).toContain('find text not matched')
  })
})
