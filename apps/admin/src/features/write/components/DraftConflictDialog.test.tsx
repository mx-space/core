import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { DraftConflictDialog } from './DraftConflictDialog'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('DraftConflictDialog', () => {
  it('explains the conflict and exposes each resolution action', () => {
    const onClose = vi.fn()
    const onKeepLocal = vi.fn()
    const onUseRemote = vi.fn()

    act(() => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(DraftConflictDialog, {
            conflictCount: 2,
            onClose,
            onKeepLocal,
            onUseRemote,
            open: true,
            remoteVersion: 7,
          }),
        ),
      )
    })

    expect(document.body.textContent).toContain('v7')

    act(() => {
      document
        .querySelector<HTMLButtonElement>(
          '[data-testid="draft-conflict-use-remote"]',
        )
        ?.click()
      document
        .querySelector<HTMLButtonElement>(
          '[data-testid="draft-conflict-keep-local"]',
        )
        ?.click()
      document
        .querySelector<HTMLButtonElement>(
          '[data-testid="draft-conflict-cancel"]',
        )
        ?.click()
    })

    expect(onUseRemote).toHaveBeenCalledOnce()
    expect(onKeepLocal).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
