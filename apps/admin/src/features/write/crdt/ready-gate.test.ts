import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReadyGate } from './ready-gate'

afterEach(() => {
  vi.useRealTimers()
})

describe('createReadyGate', () => {
  it('resolves at once when the document turned live before anyone waited', async () => {
    let live = false
    const gate = createReadyGate(() => live)
    live = true
    gate.release()

    await expect(gate.wait(1000)).resolves.toBe(true)
  })

  it('resolves waiters when released and gives up after the timeout', async () => {
    vi.useFakeTimers()
    let live = false
    const gate = createReadyGate(() => live)
    const early = gate.wait(1000)
    live = true
    gate.release()
    await expect(early).resolves.toBe(true)

    live = false
    const late = gate.wait(1000)
    vi.advanceTimersByTime(1000)
    await expect(late).resolves.toBe(false)
  })

  it('shares one attempt between callers that overlap', async () => {
    const gate = createReadyGate(() => false)
    let release: (value: boolean) => void = () => undefined
    const attempt = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        }),
    )

    const first = gate.once(attempt)
    const second = gate.once(attempt)
    release(true)

    expect(attempt).toHaveBeenCalledTimes(1)
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    void gate.once(attempt)
    expect(attempt).toHaveBeenCalledTimes(2)
  })
})
