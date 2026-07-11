// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { defineCollection, resetAllCollections } from './collection'
import { serializeListKey } from './key'
import { createTransaction } from './transaction'

interface TestEntity {
  id: string
  text?: string
  title?: string
  count?: number
}

describe('serializeListKey', () => {
  it('does not change output based on object key order', () => {
    const a = serializeListKey([{ a: 1, b: 2 }])
    const b = serializeListKey([{ b: 2, a: 1 }])
    expect(a).toBe(b)
  })

  it('is order independent for nested objects', () => {
    const a = serializeListKey([{ outer: { a: 1, b: 2 }, z: 1 }])
    const b = serializeListKey([{ z: 1, outer: { b: 2, a: 1 } }])
    expect(a).toBe(b)
  })

  it('produces different output for different values', () => {
    const a = serializeListKey([{ a: 1 }])
    const b = serializeListKey([{ a: 2 }])
    expect(a).not.toBe(b)
  })

  it('keeps array order significant', () => {
    const a = serializeListKey([1, 2, 3])
    const b = serializeListKey([3, 2, 1])
    expect(a).not.toBe(b)
  })

  it('drops undefined values inside objects like JSON.stringify', () => {
    const a = serializeListKey([{ a: 1, b: undefined }])
    const b = serializeListKey([{ a: 1 }])
    expect(a).toBe(b)
  })
})

describe('defineCollection: merge-upsert', () => {
  it('preserves fields absent from a later partial hydrate', () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
    })

    collection.hydrate([{ id: '1', text: 'full text', title: 'hello' }])
    collection.hydrate([{ id: '1', title: 'updated title' }])

    expect(collection.get('1')).toEqual({
      id: '1',
      text: 'full text',
      title: 'updated title',
    })
  })
})

describe('defineCollection: pending update survives stale hydrate', () => {
  it('keeps optimistic patch visible over a stale hydrate; commit clears it', async () => {
    let resolveUpdate: (value: TestEntity) => void = () => {}
    const onUpdate = vi.fn(
      () =>
        new Promise<TestEntity>((resolve) => {
          resolveUpdate = resolve
        }),
    )

    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
      onUpdate,
    })

    collection.hydrate([{ id: '1', text: 'original', title: 'original title' }])

    const updatePromise = collection.update('1', (draft) => {
      draft.title = 'optimistic title'
    })

    collection.hydrate([{ id: '1', text: 'original', title: 'stale title' }])

    expect(collection.get('1')?.title).toBe('optimistic title')

    resolveUpdate({ id: '1', text: 'original', title: 'server title' })
    await updatePromise

    expect(collection.get('1')?.title).toBe('server title')
    expect(collection.getBase('1')?.title).toBe('server title')
  })
})

describe('defineCollection: rollback replays remaining pending ops', () => {
  it('replays the second op over base after the first rolls back', async () => {
    let rejectFirst: (error: unknown) => void = () => {}
    const onUpdate = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirst = reject
          }),
      )
      .mockImplementationOnce(({ next }: { next: TestEntity }) =>
        Promise.resolve(next),
      )

    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
      onUpdate,
    })

    collection.hydrate([{ id: '1', count: 0 }])

    const firstUpdate = collection.update('1', (draft) => {
      draft.count = 1
    })
    const secondUpdate = collection.update('1', (draft) => {
      draft.count = 2
    })

    expect(collection.get('1')?.count).toBe(2)

    rejectFirst(new Error('boom'))
    await expect(firstUpdate).rejects.toThrow('boom')
    await secondUpdate

    expect(collection.get('1')?.count).toBe(2)
    expect(collection.getBase('1')?.count).toBe(2)
  })
})

describe('defineCollection: optimistic delete', () => {
  it('hides the entity while pending; rollback restores it', async () => {
    let rejectDelete: (error: unknown) => void = () => {}
    const onDelete = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          rejectDelete = reject
        }),
    )

    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
      onDelete,
    })

    collection.hydrate([{ id: '1', text: 'entity' }])

    const deletePromise = collection.delete('1')
    expect(collection.get('1')).toBeUndefined()

    rejectDelete(new Error('nope'))
    await expect(deletePromise).rejects.toThrow('nope')

    expect(collection.get('1')).toEqual({ id: '1', text: 'entity' })
  })
})

describe('defineCollection: onUpdate rejection', () => {
  it('releases the op, records the error, rejects, and reverts the visible value', async () => {
    const onUpdate = vi.fn(() => Promise.reject(new Error('update failed')))
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
      onUpdate,
    })

    collection.hydrate([{ id: '1', title: 'original' }])

    await expect(
      collection.update('1', (draft) => {
        draft.title = 'optimistic'
      }),
    ).rejects.toThrow('update failed')

    expect(collection.get('1')?.title).toBe('original')
    expect(collection.store.getState().errorsByKey['1']).toBeInstanceOf(Error)
    expect(collection.store.getState().pendingOpsByKey['1']).toBeUndefined()
  })
})

describe('defineCollection: onUpdate resolving with server echo', () => {
  it('merges the echo into base', async () => {
    const onUpdate = vi.fn(() =>
      Promise.resolve({ id: '1', title: 'server echo', text: 'server text' }),
    )
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
      onUpdate,
    })

    collection.hydrate([{ id: '1', title: 'original', text: 'original' }])

    await collection.update('1', (draft) => {
      draft.title = 'optimistic'
    })

    expect(collection.getBase('1')).toEqual({
      id: '1',
      title: 'server echo',
      text: 'server text',
    })
  })
})

describe('defineCollection: update on unknown entity', () => {
  it('throws', async () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
    })

    await expect(
      collection.update('missing', (draft) => {
        draft.title = 'x'
      }),
    ).rejects.toThrow('[collection:test] update on unknown entity missing')
  })
})

describe('defineCollection: version bumps', () => {
  it('bumps on hydrate, op begin, commit, and rollback', async () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
      onUpdate: () => Promise.reject(new Error('fail')),
    })

    collection.hydrate([{ id: '1', title: 'a' }])
    const afterHydrate = collection.store.getState().versionByKey['1']
    expect(afterHydrate).toBe(1)

    const updatePromise = collection.update('1', (draft) => {
      draft.title = 'b'
    })
    const afterBegin = collection.store.getState().versionByKey['1']
    expect(afterBegin).toBe(2)

    await expect(updatePromise).rejects.toThrow('fail')
    const afterRollback = collection.store.getState().versionByKey['1']
    expect(afterRollback).toBe(3)
  })

  it('strictly increases across a successful commit', async () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
      onUpdate: ({ next }) => Promise.resolve(next),
    })

    collection.hydrate([{ id: '1', title: 'a' }])
    const beforeUpdate = collection.store.getState().versionByKey['1']

    await collection.update('1', (draft) => {
      draft.title = 'b'
    })

    const afterCommit = collection.store.getState().versionByKey['1']
    expect(afterCommit).toBeGreaterThan(beforeUpdate)
  })
})

describe('defineCollection: reset', () => {
  it('restores initial empty state', () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
    })

    collection.hydrate([{ id: '1', title: 'a' }])
    collection.reset()

    expect(collection.store.getState()).toEqual({
      entitiesById: {},
      versionByKey: {},
      pendingOpsByKey: {},
      errorsByKey: {},
      listIndexes: {},
    })
  })
})

describe('resetAllCollections', () => {
  it('resets every collection registered via defineCollection', () => {
    const collectionA = defineCollection<TestEntity>({
      name: 'reset-all-a',
      getKey: (e) => e.id,
    })
    const collectionB = defineCollection<TestEntity>({
      name: 'reset-all-b',
      getKey: (e) => e.id,
    })

    collectionA.hydrate([{ id: '1', title: 'a' }])
    collectionB.hydrate([{ id: '2', title: 'b' }])

    resetAllCollections()

    const initialState = {
      entitiesById: {},
      versionByKey: {},
      pendingOpsByKey: {},
      errorsByKey: {},
      listIndexes: {},
    }
    expect(collectionA.store.getState()).toEqual(initialState)
    expect(collectionB.store.getState()).toEqual(initialState)
  })
})

describe('createTransaction: partial success', () => {
  it('commits fulfilled entities and rolls back the rest', async () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
    })

    collection.hydrate([
      { id: '1', title: 'a' },
      { id: '2', title: 'b' },
      { id: '3', title: 'c' },
    ])

    const tx = createTransaction()
    tx.delete(collection, '1')
    tx.delete(collection, '2')
    tx.delete(collection, '3')

    await tx.commit(async () => ({ fulfilledKeys: ['1', '2'] }))

    expect(collection.getBase('1')).toBeUndefined()
    expect(collection.getBase('2')).toBeUndefined()
    expect(collection.getBase('3')).toEqual({ id: '3', title: 'c' })
    expect(collection.get('3')).toEqual({ id: '3', title: 'c' })
  })
})

describe('createTransaction: request rejection', () => {
  it('rolls back everything and rethrows', async () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
    })

    collection.hydrate([
      { id: '1', title: 'a' },
      { id: '2', title: 'b' },
    ])

    const tx = createTransaction()
    tx.delete(collection, '1')
    tx.delete(collection, '2')

    await expect(
      tx.commit(async () => {
        throw new Error('network down')
      }),
    ).rejects.toThrow('network down')

    expect(collection.get('1')).toEqual({ id: '1', title: 'a' })
    expect(collection.get('2')).toEqual({ id: '2', title: 'b' })
  })
})

describe('createTransaction: registration after commit', () => {
  it('throws', async () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
    })
    collection.hydrate([{ id: '1', title: 'a' }])

    const tx = createTransaction()
    tx.delete(collection, '1')
    await tx.commit(async () => ({}))

    expect(() => tx.delete(collection, '1')).toThrow()
  })

  it('throws on double commit', async () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
    })
    collection.hydrate([{ id: '1', title: 'a' }])

    const tx = createTransaction()
    tx.delete(collection, '1')
    await tx.commit(async () => ({}))

    await expect(tx.commit(async () => ({}))).rejects.toThrow()
  })
})

describe('createTransaction: partial success does not record an error for the rolled-back entity', () => {
  it('leaves errorsByKey untouched for the entity rolled back without an error', async () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
    })

    collection.hydrate([
      { id: '1', title: 'a' },
      { id: '2', title: 'b' },
    ])

    const tx = createTransaction()
    tx.delete(collection, '1')
    tx.delete(collection, '2')

    await tx.commit(async () => ({ fulfilledKeys: ['1'] }))

    const state = collection.store.getState()
    expect('2' in state.errorsByKey).toBe(false)
  })
})

describe('createTransaction: update with partial fulfilledKeys', () => {
  it('lands the optimistic value in base after commit and clears the pending op', async () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
    })

    collection.hydrate([
      { id: '1', title: 'a' },
      { id: '2', title: 'b' },
    ])

    const tx = createTransaction()
    tx.update(collection, '1', (draft) => {
      draft.title = 'updated a'
    })
    tx.delete(collection, '2')

    await tx.commit(async () => ({ fulfilledKeys: ['1'] }))

    expect(collection.getBase('1')?.title).toBe('updated a')
    expect(collection.store.getState().pendingOpsByKey['1']).toBeUndefined()
  })
})

describe('createTransaction: commit all when no fulfilledKeys', () => {
  it('commits every registered op', async () => {
    const collection = defineCollection<TestEntity>({
      name: 'test',
      getKey: (e) => e.id,
    })

    collection.hydrate([
      { id: '1', title: 'a' },
      { id: '2', title: 'b' },
    ])

    const tx = createTransaction()
    tx.update(collection, '1', (draft) => {
      draft.title = 'updated a'
    })
    tx.delete(collection, '2')

    await tx.commit(async () => {})

    expect(collection.getBase('1')?.title).toBe('updated a')
    expect(collection.getBase('2')).toBeUndefined()
  })
})
