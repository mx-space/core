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

function render(
  value: string,
  status: 'running' | 'idle',
  uploadImage: (
    file: File,
    onProgress: (value: number) => void,
  ) => Promise<string> = async () => 'https://cdn.test/shot.png',
) {
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
        uploadImage,
        value,
      }),
    )
  })
  const button = (label: string) =>
    container!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  const textarea = container!.querySelector('textarea')!
  return { button, onAbort, onSend, textarea }
}

function paste(target: HTMLElement, files: File[]) {
  const event = Object.assign(
    new Event('paste', { bubbles: true, cancelable: true }),
    {
      clipboardData: {
        files,
        getData: () => '',
        types: files.length ? ['Files'] : ['text/plain'],
      },
    },
  )
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const chips = () => container!.querySelectorAll('[data-attachment]')
const image = () => new File(['png'], 'shot.png', { type: 'image/png' })

describe('ChatComposer', () => {
  it('sends a typed message while the agent is running', () => {
    const { button, onSend } = render('shorter please', 'running')

    act(() => button('write.agent.button.send')!.click())

    expect(onSend).toHaveBeenCalledWith('shorter please', [])
    expect(button('write.agent.aborting')).toBeNull()
  })

  it('offers stop while running with an empty input', () => {
    const { button, onAbort } = render('', 'running')

    act(() => button('write.agent.aborting')!.click())

    expect(onAbort).toHaveBeenCalled()
  })

  it('attaches a pasted image and sends it once uploaded', async () => {
    const { button, onSend, textarea } = render('look at this', 'idle')

    const event = paste(textarea, [image()])
    await settle()

    expect(event.defaultPrevented).toBe(true)
    expect(chips()).toHaveLength(1)
    act(() => button('write.agent.button.send')!.click())
    expect(onSend).toHaveBeenCalledWith('look at this', [
      expect.objectContaining({
        kind: 'image',
        status: 'ready',
        url: 'https://cdn.test/shot.png',
      }),
    ])
    expect(chips()).toHaveLength(0)
  })

  it('leaves a plain text paste to the textarea', () => {
    const { textarea } = render('', 'idle')

    const event = paste(textarea, [])

    expect(event.defaultPrevented).toBe(false)
    expect(chips()).toHaveLength(0)
  })

  it('opens the file picker from the add attachment button', () => {
    const { button } = render('', 'idle')
    const input =
      container!.querySelector<HTMLInputElement>('input[type="file"]')!
    const click = vi.spyOn(input, 'click')

    act(() => button('write.agent.attachment.add')!.click())

    expect(click).toHaveBeenCalled()
  })

  it('holds sending while an attachment is still uploading', async () => {
    const { button, textarea } = render(
      'look',
      'idle',
      () => new Promise(() => {}),
    )

    paste(textarea, [image()])
    await settle()

    expect(button('write.agent.button.send')!.disabled).toBe(true)
  })

  it('refuses a file type it cannot send', async () => {
    const { textarea } = render('', 'idle')

    paste(textarea, [
      new File(['%PDF'], 'report.pdf', { type: 'application/pdf' }),
    ])
    await settle()

    expect(chips()).toHaveLength(0)
  })
})
