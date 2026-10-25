import { Dialog } from '@base-ui/react/dialog'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'
import type { OrganizerArticle } from '~/models/draft'
import { DraftRefType } from '~/models/draft'

import { OrganizerConfirmation } from './OrganizerConfirmDialog'

let container: HTMLDivElement
let root: Root

const article = (hasChanges: boolean): OrganizerArticle => ({
  bytes: 1024,
  documentId: '1',
  draftCount: 2,
  hasChanges,
  lastEditedAt: '2026-01-01',
  refType: DraftRefType.Post,
  revisionCount: 3,
  title: 'Old article',
  version: 'a'.repeat(32),
})

function render(items: OrganizerArticle[]) {
  const confirm = vi.fn()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() =>
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(
          Dialog.Root,
          { open: true },
          createElement(OrganizerConfirmation, {
            items,
            onConfirm: confirm,
            onCancel: () => {},
          }),
        ),
      ),
    ),
  )
  const submit = [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('舍弃'),
  )!
  return { confirm, submit }
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

describe('organizer confirmation', () => {
  it('requires acknowledgement before submitting a selection containing unpublished changes', async () => {
    const { confirm, submit } = render([article(true)])
    expect(submit.disabled).toBe(true)
    expect(container.textContent).toContain('1 篇有未发布的改动')

    await act(async () =>
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click(),
    )
    expect(submit.disabled).toBe(false)
    act(() => submit.click())
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('can confirm an in-sync selection without acknowledging nonexistent changes', () => {
    const { submit } = render([article(false)])
    expect(submit.disabled).toBe(false)
    expect(container.querySelector('[role=checkbox]')).toBeNull()
  })
})
