import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { AIModelAssignmentField } from './AIModelAssignmentField'

vi.unmock('~/i18n')
let root: ReturnType<typeof createRoot>
afterEach(async () => {
  await act(async () => root?.unmount())
  document.body.innerHTML = ''
})

it('opens prices beside a compact model option without selecting it', async () => {
  localStorage.setItem('mx-admin-ui-locale', 'zh-CN')
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  const onChange = vi.fn()
  await act(async () =>
    root.render(
      <I18nProvider>
        <AIModelAssignmentField
          label="翻译"
          providers={[
            {
              id: 'cloud',
              name: 'LobeHub',
              type: 'lobehub',
              apiKey: '',
              defaultModel: '',
              enabled: true,
            },
          ]}
          value={{ providerId: 'cloud' }}
          onChange={onChange}
          models={{
            cloud: [
              {
                id: 'haiku',
                name: 'Claude Haiku',
                pricing: {
                  unit: 'token',
                  units: [
                    {
                      name: 'textInput',
                      unit: 'millionTokens',
                      strategy: 'tiered',
                      tiers: [
                        { upTo: 100000, rate: 0.1 },
                        { upTo: 'infinity', rate: 0.5 },
                      ],
                    },
                  ],
                },
              },
              { id: 'sonnet', name: 'Claude Sonnet' },
            ],
          }}
        />
      </I18nProvider>,
    ),
  )
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('button[aria-label="打开模型列表"]')!
      .click(),
  )
  const option = document.querySelector('[role="option"]')!
  expect(option.textContent).not.toContain('$')
  const info = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.getAttribute('aria-label')?.includes('价格详情'),
  )
  expect(info).toBeDefined()
  expect(info!.closest('[role="option"]')).toBeNull()
  onChange.mockClear()
  await act(async () => info!.click())
  expect(onChange).not.toHaveBeenCalled()
  expect(document.querySelector('[role="listbox"]')).not.toBeNull()
  expect(document.querySelector('table')?.textContent).toContain('$0.1')
  expect(document.querySelector('table')?.textContent).toContain('$0.5')
  expect(document.querySelector('button[aria-label="关闭价格详情"]')).toBeNull()
  expect(document.querySelector('[role="dialog"] h3')).toBeNull()
  const input = document.querySelector<HTMLInputElement>(
    'input[role="combobox"]',
  )!
  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await new Promise((resolve) => setTimeout(resolve, 200))
  })
  expect(document.querySelector('table')).toBeNull()
  expect(document.querySelector('[role="listbox"]')).not.toBeNull()
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    ),
  )
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        altKey: true,
        bubbles: true,
      }),
    ),
  )
  expect(info!.getAttribute('aria-expanded')).toBe('true')
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    ),
  )
  expect(info!.getAttribute('aria-expanded')).toBe('false')
  await act(async () => info!.click())
  await act(async () =>
    info!.parentElement!.dispatchEvent(
      new PointerEvent('pointerout', {
        pointerType: 'mouse',
        bubbles: true,
        relatedTarget: document.body,
      }),
    ),
  )
  expect(info!.getAttribute('aria-expanded')).toBe('false')
  await act(async () => input.focus())
  await act(async () => info!.click())
  await act(async () =>
    info!.parentElement!.dispatchEvent(
      new PointerEvent('pointerout', {
        pointerType: 'touch',
        bubbles: true,
        relatedTarget: document.body,
      }),
    ),
  )
  expect(info!.getAttribute('aria-expanded')).toBe('true')
  await act(async () => {
    document
      .querySelector<HTMLElement>('[aria-label="翻译思考 / Reasoning"]')!
      .focus()
    await new Promise((resolve) => setTimeout(resolve, 200))
  })
  expect(info!.getAttribute('aria-expanded')).toBe('false')
})
