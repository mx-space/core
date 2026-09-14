import { act, createElement, useState } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FormSwitch, Switch } from './switch'

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

function stubReducedMotion() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  )
}

function thumbOf(container: HTMLElement) {
  return container.querySelector(
    '[role="switch"] span',
  ) as HTMLSpanElement | null
}

let harness: Harness

beforeEach(() => {
  stubReducedMotion()
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  vi.unstubAllGlobals()
})

describe('Switch', () => {
  it('places the thumb at rest when unchecked', () => {
    act(() => {
      harness.root.render(
        createElement(Switch, {
          checked: false,
          onCheckedChange: () => {},
        }),
      )
    })
    expect(
      thumbOf(harness.container)?.style.getPropertyValue('--switch-x'),
    ).toBe('0px')
  })

  it('places the thumb at the checked offset', () => {
    act(() => {
      harness.root.render(
        createElement(Switch, {
          checked: true,
          onCheckedChange: () => {},
        }),
      )
    })
    expect(
      thumbOf(harness.container)?.style.getPropertyValue('--switch-x'),
    ).toBe('14px')
  })

  it('stretches the thumb on pointer down', async () => {
    act(() => {
      harness.root.render(
        createElement(Switch, {
          checked: false,
          onCheckedChange: () => {},
        }),
      )
    })

    const root = harness.container.querySelector('[role="switch"]')
    expect(root).toBeTruthy()
    act(() => {
      root!.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true }),
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(thumbOf(harness.container)?.style.width).toBe('22px')
  })

  it('does not stretch when disabled', async () => {
    act(() => {
      harness.root.render(
        createElement(Switch, {
          checked: false,
          disabled: true,
          onCheckedChange: () => {},
        }),
      )
    })

    const root = harness.container.querySelector('[role="switch"]')
    act(() => {
      root!.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true }),
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(thumbOf(harness.container)?.style.width).toBe('18px')
  })

  it('notifies on click', () => {
    const onCheckedChange = vi.fn()
    act(() => {
      harness.root.render(
        createElement(Switch, {
          checked: false,
          onCheckedChange,
        }),
      )
    })

    act(() => {
      harness.container
        .querySelector('[role="switch"]')
        ?.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true }),
        )
    })

    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true)
  })
})

describe('FormSwitch', () => {
  it('toggles from the labeled row', () => {
    function Probe() {
      const [checked, setChecked] = useState(false)
      return createElement(FormSwitch, {
        checked,
        label: 'Public',
        onCheckedChange: setChecked,
      })
    }

    act(() => {
      harness.root.render(createElement(Probe))
    })

    const control = harness.container.querySelector('[role="switch"]')
    expect(control?.getAttribute('aria-checked')).toBe('false')

    act(() => {
      harness.container.querySelector('label')?.click()
    })

    expect(
      harness.container
        .querySelector('[role="switch"]')
        ?.getAttribute('aria-checked'),
    ).toBe('true')
  })
})
