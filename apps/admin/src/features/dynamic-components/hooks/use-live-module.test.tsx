import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLiveModule } from './use-live-module'

const checkComponentModule = vi.fn()

vi.mock('../utils/component-source', () => ({
  checkComponentModule: (...args: unknown[]) => checkComponentModule(...args),
}))

let container: HTMLDivElement
let root: Root
let latest: ReturnType<typeof useLiveModule>
let urlCount = 0

function Probe(props: {
  previewProps?: Record<string, unknown>
  source: string | null
}) {
  latest = useLiveModule(props.source, props.previewProps ?? {})
  return null
}

function render(source: string | null, previewProps?: Record<string, unknown>) {
  act(() => root.render(createElement(Probe, { previewProps, source })))
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  urlCount = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(
    () => `blob:${++urlCount}`,
  )
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  checkComponentModule.mockReset()
  container = document.createElement('div')
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useLiveModule', () => {
  it('waits for typing to pause before building a module', async () => {
    checkComponentModule.mockResolvedValue(null)
    render('a')
    render('ab')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()

    await settle()
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(latest).toEqual({ error: null, url: 'blob:1' })
  })

  it('keeps the last working module and reports the error when a change breaks it', async () => {
    checkComponentModule.mockResolvedValueOnce(null)
    render('good')
    await settle()

    checkComponentModule.mockResolvedValueOnce('SyntaxError: nope')
    render('bad')
    await settle()

    expect(latest).toEqual({ error: 'SyntaxError: nope', url: 'blob:1' })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:2')
  })

  it('revokes the previous module once a newer one works', async () => {
    checkComponentModule.mockResolvedValue(null)
    render('one')
    await settle()
    render('two')
    await settle()

    expect(latest).toEqual({ error: null, url: 'blob:2' })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1')
  })

  it('checks the module against the current preview props', async () => {
    checkComponentModule.mockResolvedValue(null)
    render('code', { value: 1 })
    render('code', { value: 2 })
    await settle()

    expect(checkComponentModule).toHaveBeenCalledWith('blob:1', undefined, {
      value: 2,
    })
  })

  it('builds nothing while the source is not loaded', async () => {
    render(null)
    await settle()

    expect(latest).toEqual({ error: null, url: null })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
