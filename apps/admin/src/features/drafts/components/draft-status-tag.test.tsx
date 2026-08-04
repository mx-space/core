import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '~/i18n'
import type { DraftModel } from '~/models/draft'

import { DraftStatusTag } from './draft-status-tag'

let container: HTMLDivElement | undefined

function render(draft: DraftModel) {
  container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(DraftStatusTag, { draft, isSaving: false }),
      ),
    )
  })
  return container.textContent ?? ''
}

afterEach(() => {
  container?.remove()
  container = undefined
})

describe('DraftStatusTag', () => {
  it('never renders a future relative time when the save lands after the ticking clock', () => {
    const text = render({
      updatedAt: new Date(Date.now() + 20_000).toISOString(),
    } as DraftModel)

    expect(text).not.toContain('后')
    expect(text).not.toMatch(/\bin \d/)
  })
})
