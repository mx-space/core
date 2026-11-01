import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatBytes } from '~/features/files/utils/format'
import { I18nProvider } from '~/i18n'
import type { DraftStorageSummary } from '~/models/draft'

import { DraftsPageHeader } from './DraftsPageHeader'

let container: HTMLDivElement
let root: Root

const storage: DraftStorageSummary = {
  crdt: { bytes: 2048, count: 3 },
  reclaimableBytes: 5 * 1024 * 1024,
  relations: { ahead: 4, fresh: 7, inSync: 12 },
  revisions: { bytes: 8 * 1024 * 1024, count: 40 },
  updates: { bytes: 512, count: 9 },
}

function render(autoCleanup: boolean) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() =>
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          I18nProvider,
          null,
          createElement(DraftsPageHeader, {
            autoCleanup,
            fetching: false,
            onCleanup: vi.fn(),
            onRefresh: vi.fn(),
            onRelation: vi.fn(),
            onSort: vi.fn(),
            onType: vi.fn(),
            relation: 'all',
            sort: 'updated',
            storage,
            total: 23,
            type: 'all',
          }),
        ),
      ),
    ),
  )
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

describe('DraftsPageHeader', () => {
  it('shows relation segments with counts from storage', () => {
    render(true)
    const header = container.querySelector('[data-page-header]')!
    const text = header.textContent ?? ''
    expect(text).toMatch(/有改动\s*4/)
    expect(text).toMatch(/新稿\s*7/)
    expect(text).toMatch(/与发布版一致\s*12/)
    expect(text).toMatch(/全部\s*23/)
  })

  it('puts the reclaimable size on the cleanup button', () => {
    render(true)
    const button = [...container.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('清理'),
    )
    expect(button?.textContent).toContain(formatBytes(5 * 1024 * 1024))
  })

  it('shows the auto cleanup state in the summary', () => {
    render(false)
    const link = container.querySelector('a[href="/setting/storage"]')
    expect(link?.textContent).toContain('自动清理：已关闭')
  })
})
