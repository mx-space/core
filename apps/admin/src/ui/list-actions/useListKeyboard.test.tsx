import type { Ref } from 'react'
import { act, createElement, useImperativeHandle, useRef } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FocusScope, setActiveScope } from '~/ui/focus-scope'
import type { ListSelectionAPI } from '~/ui/list-actions/useListSelection'

import { useListKeyboard } from './useListKeyboard'

interface Row {
  id: string
}

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

interface ProbeHandle {
  selection: ListSelectionAPI<Row>
}

function Probe({
  items,
  scopeId,
  apiRef,
}: {
  items: Row[]
  scopeId: string
  apiRef: Ref<ProbeHandle>
}) {
  const { selection } = useListKeyboard<Row>({
    actions: [],
    getId: (row) => row.id,
    items,
    scopeId,
  })
  const selRef = useRef(selection)
  selRef.current = selection
  useImperativeHandle(apiRef, () => ({
    get selection() {
      return selRef.current
    },
  }))
  return createElement(
    'div',
    null,
    items.map((row) =>
      createElement(
        'div',
        {
          'data-id': row.id,
          'data-scope-item': 'row',
          key: row.id,
          tabIndex: 0,
        },
        row.id,
      ),
    ),
  )
}

function renderProbe(
  harness: Harness,
  items: Row[],
  scopeId: string,
): { handle: ProbeHandle } {
  const ref: { current: ProbeHandle | null } = { current: null }
  act(() => {
    harness.root.render(
      createElement(FocusScope, {
        children: createElement(Probe, { apiRef: ref, items, scopeId }),
        id: scopeId,
      }),
    )
  })
  if (!ref.current) {
    throw new Error('Probe ref did not attach')
  }
  return { handle: ref.current }
}

function dispatchKey(init: KeyboardEventInit & { code?: string }) {
  act(() => {
    const event = new KeyboardEvent('keydown', { bubbles: true, ...init })
    // happy-dom's `KeyboardEvent` ctor does not always carry `getModifierState`
    // or the `code` field through — tinykeys' `isKeyboardEvent` guard short-
    // circuits without them. Patch them in.
    const code = init.code ?? deriveCode(init.key ?? '')
    if (!event.code) {
      Object.defineProperty(event, 'code', { configurable: true, value: code })
    }
    if (typeof event.getModifierState !== 'function') {
      Object.defineProperty(event, 'getModifierState', {
        configurable: true,
        value: (mod: string) => {
          if (mod === 'Shift') return Boolean(init.shiftKey)
          if (mod === 'Control') return Boolean(init.ctrlKey)
          if (mod === 'Alt') return Boolean(init.altKey)
          if (mod === 'Meta') return Boolean(init.metaKey)
          return false
        },
      })
    }
    window.dispatchEvent(event)
  })
}

function deriveCode(key: string): string {
  if (key.length === 1 && /[a-z]/i.test(key)) return `Key${key.toUpperCase()}`
  return key
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  setActiveScope(null)
  document.body.innerHTML = ''
})

describe('useListKeyboard — range-select defaultExtras', () => {
  const items: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
  const scopeId = 'range-select-test'

  function setupAtCursor(cursorIdx: number): ProbeHandle {
    const { handle } = renderProbe(harness, items, scopeId)
    setActiveScope(scopeId)
    // Seed an anchor by selecting one row, then plant the cursor on the same
    // row — mirrors the post-Space promotion from the L1 spec.
    act(() => {
      handle.selection.selectOne(items[cursorIdx].id)
      handle.selection.setCursor(items[cursorIdx].id)
    })
    return handle
  }

  it('Shift+ArrowDown extends selection from cursor to next row and moves the cursor', () => {
    const handle = setupAtCursor(1)
    dispatchKey({ key: 'ArrowDown', shiftKey: true })
    const ids = [...handle.selection.selectedIds].sort()
    expect(ids).toEqual(['b', 'c'])
    expect(handle.selection.cursorId).toBe('c')
  })

  it('Shift+ArrowUp extends selection from cursor to previous row and moves the cursor', () => {
    const handle = setupAtCursor(2)
    dispatchKey({ key: 'ArrowUp', shiftKey: true })
    const ids = [...handle.selection.selectedIds].sort()
    expect(ids).toEqual(['b', 'c'])
    expect(handle.selection.cursorId).toBe('b')
  })

  it('Shift+j extends selection forward (vim-style)', () => {
    const handle = setupAtCursor(0)
    dispatchKey({ key: 'j', shiftKey: true })
    const ids = [...handle.selection.selectedIds].sort()
    expect(ids).toEqual(['a', 'b'])
    expect(handle.selection.cursorId).toBe('b')
  })

  it('Shift+k extends selection backward (vim-style)', () => {
    const handle = setupAtCursor(3)
    dispatchKey({ key: 'k', shiftKey: true })
    const ids = [...handle.selection.selectedIds].sort()
    expect(ids).toEqual(['c', 'd'])
    expect(handle.selection.cursorId).toBe('c')
  })

  it('does nothing at the boundary (last row, Shift+ArrowDown)', () => {
    const handle = setupAtCursor(items.length - 1)
    const before = handle.selection.cursorId
    dispatchKey({ key: 'ArrowDown', shiftKey: true })
    expect(handle.selection.cursorId).toBe(before)
    expect(handle.selection.selectedIds.size).toBe(1)
  })

  it('does nothing when no cursor is set', () => {
    const { handle } = renderProbe(harness, items, scopeId)
    setActiveScope(scopeId)
    dispatchKey({ key: 'ArrowDown', shiftKey: true })
    expect(handle.selection.cursorId).toBeNull()
    expect(handle.selection.selectedIds.size).toBe(0)
  })
})
