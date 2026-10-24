import { createAgentStore } from '@haklex/rich-agent-core'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChatComposer } from './ChatComposer'

vi.mock('~/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('./ModelSelector', () => ({ ModelSelector: () => null }))

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

function render(value: string, status: 'running' | 'idle') {
  const store = createAgentStore()
  store.getState().setStatus(status)
  const onSend = vi.fn()
  const onAbort = vi.fn()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      createElement(ChatComposer, {
        agentReady: true,
        isLoadingModels: false,
        onAbort,
        onChange: () => {},
        onSelectModel: () => {},
        onSend,
        providerGroups: [],
        selectedModel: { modelId: 'm', providerId: 'p' } as any,
        store,
        value,
      }),
    )
  })
  const button = (label: string) =>
    container!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  return { button, onAbort, onSend }
}

describe('ChatComposer', () => {
  it('sends a typed message while the agent is running', () => {
    const { button, onSend } = render('shorter please', 'running')

    act(() => button('write.agent.button.send')!.click())

    expect(onSend).toHaveBeenCalledWith('shorter please')
    expect(button('write.agent.aborting')).toBeNull()
  })

  it('offers stop while running with an empty input', () => {
    const { button, onAbort } = render('', 'running')

    act(() => button('write.agent.aborting')!.click())

    expect(onAbort).toHaveBeenCalled()
  })
})
