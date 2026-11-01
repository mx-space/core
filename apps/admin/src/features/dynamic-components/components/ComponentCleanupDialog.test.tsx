import { Dialog } from '@base-ui/react/dialog'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ContentUsage } from '~/api/content-usage'
import type { DynamicCatalogEntry } from '~/api/dynamic-components'
import { formatBytes } from '~/features/files/utils/format'
import { I18nProvider } from '~/i18n'

import { classifyDynamicComponents } from '../utils/component-usage'
import { ComponentCleanupPanel } from './ComponentCleanupDialog'

const base = 'https://object.innei.in/versions/'

let container: HTMLDivElement
let root: Root

function entry(id: string, extra: Partial<DynamicCatalogEntry> = {}) {
  return {
    description: '',
    id,
    initialHeight: 200,
    name: id,
    propsSchema: {},
    url: `${base}${id}.js`,
    ...extra,
  }
}

function usage(url: string, extra: Partial<ContentUsage> = {}): ContentUsage {
  return {
    bytes: 1000,
    drafts: [],
    fileReferenceId: `ref-${url}`,
    historyOnly: false,
    other: [],
    published: [],
    url,
    ...extra,
  }
}

const old = `${base}used-old.js`
const report = classifyDynamicComponents({
  catalog: {
    components: [
      entry('unused'),
      entry('used', { previousUrls: [old] }),
      entry('draft'),
    ],
    version: 1,
  },
  orphanFiles: [
    {
      byteSize: 700,
      createdAt: '2026-01-01T00:00:00Z',
      fileName: 'stray.js',
      fileUrl: `${base}stray.js`,
      id: 'orphan-1',
    },
  ],
  usage: [
    usage(`${base}unused.js`, { bytes: 400 }),
    usage(`${base}used.js`, {
      published: [{ id: 'p1', title: 'Post', type: 'post' }],
    }),
    usage(old, { bytes: 300 }),
    usage(`${base}draft.js`, {
      drafts: [{ documentId: 'd', draftId: 'dr', live: false, title: 'WIP' }],
    }),
  ],
})

function render() {
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
          createElement(ComponentCleanupPanel, {
            onCancel: vi.fn(),
            onConfirm: vi.fn(),
            pending: false,
            report,
          }),
        ),
      ),
    ),
  )
}

function checkedOf(key: string) {
  return container
    .querySelector(`[data-candidate="${key}"] [role=checkbox]`)
    ?.getAttribute('aria-checked')
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

describe('ComponentCleanupPanel', () => {
  it('pre-checks safe candidates and leaves draft-only entries unchecked', () => {
    render()
    expect(checkedOf('entry:unused')).toBe('true')
    expect(checkedOf(`version:used:${old}`)).toBe('true')
    expect(checkedOf('file:orphan-1')).toBe('true')
    expect(checkedOf('entry:draft')).toBe('false')
    expect(
      container
        .querySelector('[data-candidate="entry:draft"] [role=checkbox]')
        ?.hasAttribute('data-disabled'),
    ).toBe(true)
    expect(container.textContent).toContain('WIP')
  })

  it('shows the reclaimable total in the footer', () => {
    render()
    expect(report.reclaimableBytes).toBe(1400)
    expect(
      container.querySelector('[data-cleanup-total]')?.textContent,
    ).toContain(formatBytes(1400))
  })
})
