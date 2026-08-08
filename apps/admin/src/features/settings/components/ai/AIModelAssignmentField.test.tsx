import { act, useState } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import type { AIModelAssignment } from '../../types/settings'
import { AIModelAssignmentField } from './AIModelAssignmentField'

interface Harness {
  container: HTMLDivElement
  root: Root
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

let harness: Harness

beforeEach(() => {
  const container = document.createElement('div')
  document.body.append(container)
  harness = { container, root: createRoot(container) }
})

afterEach(() => {
  act(() => harness.root.unmount())
  document.body.innerHTML = ''
})

describe('AIModelAssignmentField', () => {
  it('filters discovered speech models and selects a matching model id', async () => {
    const onChange = vi.fn()

    function FieldHarness() {
      const [value, setValue] = useState<AIModelAssignment | null>({
        providerId: 'openrouter',
      })
      return (
        <AIModelAssignmentField
          capability="speech"
          label="语音生成模型"
          models={{
            openrouter: [
              { id: 'fish-audio/s1', name: 'Fish Audio: S1' },
              {
                id: 'x-ai/grok-voice-tts-1.0',
                name: 'SpaceXAI: Grok Voice TTS 1.0',
                pricing: {
                  completion: '0',
                  prompt: '0.000015',
                  unit: 'character',
                },
              },
              {
                id: 'microsoft/mai-voice-2-flash',
                name: 'Microsoft: MAI-Voice-2-Flash',
              },
              {
                id: 'openai/gpt-4o-mini-tts-2025-12-15',
                name: 'OpenAI: GPT-4o Mini TTS',
              },
            ],
          }}
          onChange={(next) => {
            setValue(next)
            onChange(next)
          }}
          providers={[
            {
              apiKey: 'test-key',
              capabilities: { image: false, speech: true, text: true },
              defaultModel: 'openai/gpt-5.5',
              enabled: true,
              id: 'openrouter',
              name: 'OpenRouter',
              type: 'openai-compatible',
            },
          ]}
          value={value}
        />
      )
    }

    await act(async () => {
      harness.root.render(
        <I18nProvider>
          <FieldHarness />
        </I18nProvider>,
      )
    })

    const trigger = document.querySelector<HTMLButtonElement>(
      'button[aria-label="打开模型列表"]',
    )
    expect(trigger).not.toBeNull()
    await act(async () => trigger?.click())

    expect(document.body.textContent).toContain('Fish Audio: S1')
    expect(document.body.textContent).toContain('Microsoft: MAI-Voice-2-Flash')
    expect(document.body.textContent).toContain('$15 / 100 万字符')

    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="语音生成模型模型"]',
    )
    expect(input).not.toBeNull()
    await act(async () => setInputValue(input!, 'GPT-4o Mini TTS'))

    expect(document.body.textContent).not.toContain('Fish Audio: S1')
    expect(document.body.textContent).not.toContain(
      'Microsoft: MAI-Voice-2-Flash',
    )
    expect(document.body.textContent).toContain('OpenAI: GPT-4o Mini TTS')

    const option = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]'),
    ).find((element) =>
      element.textContent?.includes('OpenAI: GPT-4o Mini TTS'),
    )
    expect(option).toBeDefined()
    await act(async () => option?.click())

    expect(onChange).toHaveBeenLastCalledWith({
      model: 'openai/gpt-4o-mini-tts-2025-12-15',
      providerId: 'openrouter',
      reasoningEffort: undefined,
    })
  })
})
