import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { CompanionPairingPanel } from './CompanionPairingPanel'

interface Harness {
  container: HTMLDivElement
  root: Root
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  return { container, root: createRoot(container) }
}

let harness: Harness

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-16T01:00:00.000Z'))
  harness = mount()
})

afterEach(() => {
  act(() => harness.root.unmount())
  harness.container.remove()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('CompanionPairingPanel', () => {
  it('stops exposing an expired pairing code as a usable credential', () => {
    const onCopy = vi.fn()
    const onCreate = vi.fn()

    act(() => {
      harness.root.render(
        createElement(
          I18nProvider,
          null,
          createElement(CompanionPairingPanel, {
            isCreating: false,
            onCopy,
            onCreate,
            pairing: {
              expiresAt: '2026-07-16T01:00:01.500Z',
              pairingCode: 'ABCD-EFGH',
              pairingId: '02ea9454-76ba-4054-86c4-aceb18a198f7',
            },
          }),
        ),
      )
    })

    const copyButton = harness.container.querySelector<HTMLButtonElement>(
      '[data-testid="companion-copy-code"]',
    )
    const createButton = harness.container.querySelector<HTMLButtonElement>(
      '[data-testid="companion-create-pairing"]',
    )
    expect(copyButton?.disabled).toBe(false)
    expect(createButton?.disabled).toBe(true)

    act(() => vi.advanceTimersByTime(2_000))

    expect(copyButton?.disabled).toBe(true)
    expect(createButton?.disabled).toBe(false)
    act(() => copyButton?.click())
    expect(onCopy).not.toHaveBeenCalled()
  })
})
