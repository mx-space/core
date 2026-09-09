import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCloseOnAnchorHidden } from './useCloseOnAnchorHidden'

function Probe(props: { close: () => void; hidden: boolean; open: boolean }) {
  const ref = useCloseOnAnchorHidden<HTMLDivElement>(props.close)
  return createElement('div', {
    'data-anchor-hidden': props.hidden ? '' : undefined,
    'data-open': props.open ? '' : undefined,
    ref,
  })
}

let container: HTMLDivElement
let root: Root

const flushMutations = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('useCloseOnAnchorHidden', () => {
  it('closes when the anchor becomes hidden while open', async () => {
    const close = vi.fn()
    act(() => {
      root.render(createElement(Probe, { close, hidden: false, open: true }))
    })
    expect(close).not.toHaveBeenCalled()

    act(() => {
      root.render(createElement(Probe, { close, hidden: true, open: true }))
    })
    await flushMutations()
    expect(close).toHaveBeenCalled()
  })

  it('stays quiet while the menu is closed', async () => {
    const close = vi.fn()
    act(() => {
      root.render(createElement(Probe, { close, hidden: false, open: false }))
    })
    act(() => {
      root.render(createElement(Probe, { close, hidden: true, open: false }))
    })
    await flushMutations()
    expect(close).not.toHaveBeenCalled()
  })
})
