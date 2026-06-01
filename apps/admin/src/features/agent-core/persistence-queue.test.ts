// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { createPersistenceQueue } from './persistence-queue'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('createPersistenceQueue', () => {
  it('serializes saves and coalesces pending snapshots to the latest value', async () => {
    const first = deferred<string>()
    const saved: string[] = []
    const queue = createPersistenceQueue({
      save: (snapshot: string) => {
        saved.push(snapshot)
        if (snapshot === 'a') return first.promise
        return Promise.resolve(snapshot)
      },
    })

    const firstSave = queue.enqueue('a')
    queue.enqueue('b')
    queue.enqueue('c')

    expect(saved).toEqual(['a'])
    first.resolve('a')
    await firstSave

    expect(saved).toEqual(['a', 'c'])
    expect(queue.hasPending()).toBe(false)
  })

  it('flush waits for the active drain', async () => {
    const gate = deferred<string>()
    const queue = createPersistenceQueue({
      save: () => gate.promise,
    })

    queue.enqueue('snapshot')
    const flushed = queue.flush()
    gate.resolve('saved')

    await expect(flushed).resolves.toBe('saved')
  })
})
