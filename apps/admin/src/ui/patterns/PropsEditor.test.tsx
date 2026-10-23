import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { PropsEditor } from './PropsEditor'

const schema = { properties: { value: { type: 'number' } } }

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

function render(value: Record<string, unknown>, onChange = vi.fn()) {
  act(() => {
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(PropsEditor, { onChange, schema, value }),
      ),
    )
  })
  return onChange
}

function switchToJson() {
  const tab = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === 'JSON',
  )!
  act(() => tab.click())
  return container.querySelector('textarea')!
}

function typeInto(textarea: HTMLTextAreaElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )!.set!
  act(() => {
    setter.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('PropsEditor', () => {
  it('starts on the form when the schema has editable fields', () => {
    render({ value: 3 })

    expect(container.querySelector('input[name="value"]')).not.toBeNull()
    expect(container.querySelector('textarea')).toBeNull()
  })

  it('shows the current props as JSON in the JSON view', () => {
    render({ value: 3 })

    expect(JSON.parse(switchToJson().value)).toEqual({ value: 3 })
  })

  it('applies valid JSON and ignores invalid JSON with an error', () => {
    const onChange = render({ value: 3 })
    const textarea = switchToJson()

    typeInto(textarea, '{ "value": ')
    expect(onChange).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')).not.toBeNull()

    typeInto(textarea, '{ "value": 7 }')
    expect(onChange).toHaveBeenLastCalledWith({ value: 7 })
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('starts on JSON when the schema has no editable fields', () => {
    act(() => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(PropsEditor, {
            onChange: vi.fn(),
            schema: {},
            value: {},
          }),
        ),
      )
    })

    expect(container.querySelector('textarea')).not.toBeNull()
  })
})
