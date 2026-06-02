import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { ReplyComposer } from './ReplyComposer'

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function renderComposer(
  harness: Harness,
  props: Partial<Parameters<typeof ReplyComposer>[0]> = {},
) {
  const onSubmit = props.onSubmit ?? vi.fn(async () => undefined)
  act(() => {
    harness.root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          I18nProvider,
          null,
          createElement(ReplyComposer, {
            onSubmit,
            ownerName: 'Owner',
            pending: false,
            threadParticipants: [{ name: 'Alice' }, { name: 'Bob' }],
            ...props,
          }),
        ),
      ),
    )
  })
  return { onSubmit }
}

function getTextarea(): HTMLTextAreaElement {
  const el = document.querySelector('textarea')
  if (!el) throw new Error('textarea missing')
  return el as HTMLTextAreaElement
}

function setValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set
  setter?.call(textarea, value)
  textarea.selectionStart = value.length
  textarea.selectionEnd = value.length
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

describe('ReplyComposer', () => {
  it('exposes an emoji picker trigger', () => {
    renderComposer(harness)
    const trigger = document.querySelector(
      'button[aria-label="插入表情"], button[aria-label="Insert emoji"]',
    )
    expect(trigger).not.toBeNull()
  })

  it('submits with Cmd+Enter', async () => {
    const onSubmit = vi.fn(async () => undefined)
    renderComposer(harness, { onSubmit })
    const textarea = getTextarea()
    act(() => {
      setValue(textarea, 'hello world')
    })
    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Enter',
          metaKey: true,
        }),
      )
    })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('hello world')
  })

  it('wraps selection with ** on Cmd+B', () => {
    renderComposer(harness)
    const textarea = getTextarea()
    act(() => {
      setValue(textarea, 'bold me')
      textarea.selectionStart = 0
      textarea.selectionEnd = 4
    })
    act(() => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'b',
          metaKey: true,
        }),
      )
    })

    expect(textarea.value).toBe('**bold** me')
  })
})
