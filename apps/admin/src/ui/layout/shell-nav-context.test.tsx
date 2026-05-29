import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Root } from 'react-dom/client'

import { ShellNavProvider, useShellNav } from '~/ui/layout/shell-nav-context'

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

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

describe('ShellNavContext', () => {
  it('useShellNav returns null when no provider is present', () => {
    const captured: Array<ReturnType<typeof useShellNav>> = []
    function Probe() {
      captured.push(useShellNav())
      return null
    }
    act(() => {
      harness.root.render(createElement(Probe))
    })
    expect(captured.at(-1)).toBeNull()
  })

  it('useShellNav returns the value when wrapped in ShellNavProvider', () => {
    const setOpen = vi.fn()
    const captured: Array<ReturnType<typeof useShellNav>> = []
    function Probe() {
      captured.push(useShellNav())
      return null
    }
    act(() => {
      harness.root.render(
        createElement(ShellNavProvider, {
          children: createElement(Probe),
          open: true,
          setOpen,
        }),
      )
    })
    const value = captured.at(-1)
    expect(value).not.toBeNull()
    expect(value!.open).toBe(true)
    expect(typeof value!.setOpen).toBe('function')
    expect(typeof value!.toggle).toBe('function')
  })

  it('toggle flips open by calling setOpen with the inverted value', () => {
    const setOpen = vi.fn()
    const captured: Array<ReturnType<typeof useShellNav>> = []
    function Probe() {
      captured.push(useShellNav())
      return null
    }
    act(() => {
      harness.root.render(
        createElement(ShellNavProvider, {
          children: createElement(Probe),
          open: false,
          setOpen,
        }),
      )
    })
    captured.at(-1)!.toggle()
    expect(setOpen).toHaveBeenLastCalledWith(true)

    act(() => {
      harness.root.render(
        createElement(ShellNavProvider, {
          children: createElement(Probe),
          open: true,
          setOpen,
        }),
      )
    })
    captured.at(-1)!.toggle()
    expect(setOpen).toHaveBeenLastCalledWith(false)
  })

  it('registerPageHeader flips hasOwnHeader to true and cleanup flips it back', () => {
    const setOpen = vi.fn()
    const captured: Array<ReturnType<typeof useShellNav>> = []
    function Probe() {
      captured.push(useShellNav())
      return null
    }
    act(() => {
      harness.root.render(
        createElement(ShellNavProvider, {
          children: createElement(Probe),
          open: false,
          setOpen,
        }),
      )
    })
    expect(captured.at(-1)!.hasOwnHeader).toBe(false)

    let dispose: () => void = () => {}
    act(() => {
      dispose = captured.at(-1)!.registerPageHeader()
    })
    expect(captured.at(-1)!.hasOwnHeader).toBe(true)

    act(() => {
      dispose()
    })
    expect(captured.at(-1)!.hasOwnHeader).toBe(false)
  })

  it('two simultaneous registrations keep hasOwnHeader true until both clean up', () => {
    const setOpen = vi.fn()
    const captured: Array<ReturnType<typeof useShellNav>> = []
    function Probe() {
      captured.push(useShellNav())
      return null
    }
    act(() => {
      harness.root.render(
        createElement(ShellNavProvider, {
          children: createElement(Probe),
          open: false,
          setOpen,
        }),
      )
    })

    let disposeA: () => void = () => {}
    let disposeB: () => void = () => {}
    act(() => {
      disposeA = captured.at(-1)!.registerPageHeader()
      disposeB = captured.at(-1)!.registerPageHeader()
    })
    expect(captured.at(-1)!.hasOwnHeader).toBe(true)

    act(() => {
      disposeA()
    })
    expect(captured.at(-1)!.hasOwnHeader).toBe(true)

    act(() => {
      disposeB()
    })
    expect(captured.at(-1)!.hasOwnHeader).toBe(false)
  })

  it('setOpen and toggle are stable across re-renders when open is unchanged', () => {
    const setOpen = vi.fn()
    const captured: Array<ReturnType<typeof useShellNav>> = []
    let effectRuns = 0
    function Probe() {
      const value = useShellNav()
      captured.push(value)
      useEffect(() => {
        effectRuns += 1
      }, [value])
      return null
    }
    act(() => {
      harness.root.render(
        createElement(ShellNavProvider, {
          children: createElement(Probe),
          open: false,
          setOpen,
        }),
      )
    })
    const first = captured.at(-1)!
    act(() => {
      harness.root.render(
        createElement(ShellNavProvider, {
          children: createElement(Probe),
          open: false,
          setOpen,
        }),
      )
    })
    const second = captured.at(-1)!
    expect(second).toBe(first)
    expect(second.setOpen).toBe(first.setOpen)
    expect(second.toggle).toBe(first.toggle)
    expect(effectRuns).toBe(1)
  })
})
