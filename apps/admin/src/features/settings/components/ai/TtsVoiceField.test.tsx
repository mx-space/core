import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TtsVoiceDiscoveryResponse } from '~/api/ai'
import { UI_LOCALE_STORAGE_KEY } from '~/constants/keys'
import { I18nProvider } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'

import { TtsVoiceField } from './TtsVoiceField'

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

let container: HTMLDivElement
let queryClient: QueryClient
let root: Root

beforeEach(() => {
  localStorage.setItem(UI_LOCALE_STORAGE_KEY, 'zh-CN')
  container = document.createElement('div')
  document.body.append(container)
  queryClient = new QueryClient()
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  queryClient.clear()
  document.body.innerHTML = ''
  localStorage.removeItem(UI_LOCALE_STORAGE_KEY)
})

describe('TtsVoiceField', () => {
  it('lists, filters, and selects voices discovered from model metadata', async () => {
    const providerId = 'openrouter'
    const model = 'x-ai/grok-voice-tts-1.0'
    const voiceIds = ['eve', 'ara', 'rex', 'sal', 'leo']
    queryClient.setQueryData<TtsVoiceDiscoveryResponse>(
      adminQueryKeys.ai.ttsVoices(providerId, model),
      {
        manualInputAllowed: true,
        source: 'remote',
        voices: voiceIds.map((id) => ({
          id,
          kind: 'provider',
          name: id[0].toUpperCase() + id.slice(1),
        })),
      },
    )
    const onChange = vi.fn()

    function FieldHarness() {
      const [value, setValue] = useState('')
      return (
        <TtsVoiceField
          model={model}
          onChange={(next) => {
            setValue(next)
            onChange(next)
          }}
          providerId={providerId}
          value={value}
        />
      )
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <FieldHarness />
          </I18nProvider>
        </QueryClientProvider>,
      )
    })

    const trigger = document.querySelector<HTMLButtonElement>(
      'button[aria-label="打开音色列表"]',
    )
    expect(trigger).not.toBeNull()
    await act(async () => trigger?.click())

    expect(document.body.textContent).toContain('Eve')
    expect(document.body.textContent).toContain('Rex')
    expect(document.body.textContent).toContain('已发现 5 个音色')

    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="音色 ID"]',
    )
    expect(input).not.toBeNull()
    await act(async () => setInputValue(input!, 'rex'))

    expect(document.body.textContent).not.toContain('Ara')
    const option = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]'),
    ).find((element) => element.textContent?.includes('Rex'))
    expect(option).toBeDefined()
    await act(async () => option?.click())

    expect(onChange).toHaveBeenLastCalledWith('rex')
  })
})
