import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { FilterStrip, type FilterStripProps } from './FilterStrip'

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function render(props: FilterStripProps) {
  act(() => {
    harness.root.render(
      createElement(I18nProvider, null, createElement(FilterStrip, props)),
    )
  })
}

function q(id: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

describe('FilterStrip refType chips', () => {
  it('fires onRefTypeChange when a chip is clicked', () => {
    const onRefTypeChange = vi.fn()
    render({ refType: 'all', onRefTypeChange })
    act(() => {
      ;(q('comments-reftype-post') as HTMLButtonElement).click()
    })
    expect(onRefTypeChange).toHaveBeenCalledWith('post')
  })

  it('marks the active chip with aria-pressed=true', () => {
    render({ refType: 'note', onRefTypeChange: vi.fn() })
    expect(q('comments-reftype-note')?.getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(q('comments-reftype-post')?.getAttribute('aria-pressed')).toBe(
      'false',
    )
  })
})

describe('FilterStrip source chip', () => {
  it('renders the active source chip with a clear button', () => {
    const onClearSource = vi.fn()
    render({
      refType: 'post',
      onRefTypeChange: vi.fn(),
      sourceLabel: 'Why I left Notion',
      onClearSource,
    })
    const chip = q('comments-source-chip')
    expect(chip?.textContent).toContain('Why I left Notion')

    const clear = q('comments-source-chip-clear') as HTMLButtonElement | null
    expect(clear).not.toBeNull()
    act(() => {
      clear!.click()
    })
    expect(onClearSource).toHaveBeenCalledTimes(1)
  })

  it('omits the source chip when sourceLabel is missing', () => {
    render({ refType: 'all', onRefTypeChange: vi.fn() })
    expect(q('comments-source-chip')).toBeNull()
  })
})

describe('FilterStrip total', () => {
  it('renders the shown-of-total label when totalOf differs', () => {
    render({
      refType: 'all',
      onRefTypeChange: vi.fn(),
      total: 238,
      totalOf: 980,
    })
    const total = q('comments-filter-total')
    expect(total?.textContent).toContain('238')
    expect(total?.textContent).toContain('980')
  })

  it('renders the simple total count when totalOf matches', () => {
    render({
      refType: 'all',
      onRefTypeChange: vi.fn(),
      total: 500,
      totalOf: 500,
    })
    const total = q('comments-filter-total')
    expect(total?.textContent).toContain('500')
  })
})
