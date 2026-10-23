import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement, useState } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import type { DynamicCatalog } from '~/api/dynamic-components'
import { I18nProvider } from '~/i18n'

import { DynamicComponentSourcePanel } from './DynamicComponentSourcePanel'

let finishSave: (catalog: DynamicCatalog) => void = () => {}

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('~/ui/primitives/code-editor', async () => {
  const { createElement: h } = await import('react')
  return {
    CodeEditor: (props: { onChange: (value: string) => void; value: string }) =>
      h('textarea', {
        'data-testid': 'code',
        onChange: (event: { target: { value: string } }) =>
          props.onChange(event.target.value),
        value: props.value,
      }),
  }
})
vi.mock('./DynamicComponentPreview', () => ({
  DynamicComponentPreview: () => null,
}))
vi.mock('../hooks/use-live-module', () => ({
  useLiveModule: () => ({ error: null, url: null }),
}))
vi.mock('../hooks/use-dynamic-catalog', () => ({
  useApplyDynamicCatalog: () => () => {},
}))
vi.mock('../utils/component-source', () => ({
  fetchComponentSource: async () => 'v1',
  saveComponentSource: () =>
    new Promise<DynamicCatalog>((resolve) => {
      finishSave = resolve
    }),
}))

const item = {
  id: '42',
  name: 'Ring',
  description: '',
  url: 'https://cdn.example/v1.js',
  initialHeight: 100,
  propsSchema: {},
}

let container: HTMLDivElement
let root: Root

function Harness() {
  const [draft, setDraft] = useState<string | null>(null)
  return createElement(DynamicComponentSourcePanel, {
    draft,
    item,
    onDraftChange: setDraft,
    onPreviewPropsChange: () => {},
    previewProps: {},
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function typeCode(text: string) {
  const textarea = container.querySelector<HTMLTextAreaElement>(
    '[data-testid="code"]',
  )!
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )!.set!
  act(() => {
    setter.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('keeps edits typed while a save is in flight', async () => {
  const queryClient = new QueryClient()
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(I18nProvider, null, createElement(Harness)),
      ),
    )
  })

  await vi.waitFor(() =>
    expect(container.querySelector('[data-testid="code"]')).not.toBeNull(),
  )

  typeCode('v2')
  const saveButton = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '保存为新版本',
  )!
  await act(async () => saveButton.click())
  await vi.waitFor(() => expect(saveButton.textContent).toBe('保存中…'))

  typeCode('v2 plus more')
  await act(async () => {
    finishSave({
      version: 1,
      components: [{ ...item, url: 'https://cdn.example/v2.js' }],
    })
  })
  await vi.waitFor(() => expect(saveButton.textContent).toBe('保存为新版本'))

  expect(
    container.querySelector<HTMLTextAreaElement>('[data-testid="code"]')!.value,
  ).toBe('v2 plus more')
})
