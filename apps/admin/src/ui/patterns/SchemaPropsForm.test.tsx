import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { SchemaPropsForm } from './SchemaPropsForm'

const schema = {
  type: 'object',
  required: ['value'],
  properties: {
    label: { type: 'string', default: 'Goal' },
    value: { type: 'number' },
    rows: { type: 'array' },
  },
}

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
        createElement(SchemaPropsForm, { onChange, schema, value }),
      ),
    )
  })
  return onChange
}

function typeInto(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!
  act(() => {
    setter.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('SchemaPropsForm', () => {
  it('renders one control per editable property with the current values', () => {
    render({ label: 'Chapters', value: 9 })

    const label = container.querySelector<HTMLInputElement>(
      'input[name="label"]',
    )
    const value = container.querySelector<HTMLInputElement>(
      'input[name="value"]',
    )
    expect(label?.value).toBe('Chapters')
    expect(value?.value).toBe('9')
    expect(container.querySelector('[name="rows"]')).toBeNull()
  })

  it('marks required fields', () => {
    render({})

    expect(
      container.querySelector<HTMLInputElement>('input[name="value"]')
        ?.required,
    ).toBe(true)
    expect(
      container.querySelector<HTMLInputElement>('input[name="label"]')
        ?.required,
    ).toBe(false)
  })

  it('reports the whole props object with the edited field coerced', () => {
    const onChange = render({ label: 'Chapters', rows: [1] })

    typeInto(
      container.querySelector<HTMLInputElement>('input[name="value"]')!,
      '12',
    )

    expect(onChange).toHaveBeenLastCalledWith({
      label: 'Chapters',
      rows: [1],
      value: 12,
    })
  })

  it('says so when the schema has no editable fields', () => {
    act(() => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(SchemaPropsForm, {
            onChange: vi.fn(),
            schema: {},
            value: {},
          }),
        ),
      )
    })

    expect(container.textContent).toContain('JSON')
  })
})
